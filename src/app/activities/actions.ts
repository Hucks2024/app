"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { requireUser, requireMember } from "@/lib/auth";
import { geocodeLocation } from "@/lib/geocode";
import { CATEGORY_VALUES, categoriesForClub, defaultCategoryFor } from "@/lib/categories";
import { clubFor } from "@/lib/clubs";

const createSchema = z.object({
  title: z.string().trim().min(3, "Give your meetup a name").max(120),
  category: z
    .string()
    .refine((v) => CATEGORY_VALUES.includes(v), "Pick what kind of meetup this is")
    .default("RUN"),
  afterSpot: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  location: z.string().trim().min(3, "Where does it start?").max(200),
  startsAt: z.string().min(1, "Pick a date and time"),
  distanceKm: z.coerce.number().positive().max(500).optional(),
  pace: z.string().trim().max(40).optional(),
  maxParticipants: z.coerce.number().int().positive().max(500).optional(),
  stravaUrl: z
    .string()
    .trim()
    .url("That doesn't look like a valid URL")
    .max(300)
    // .url() alone accepts any scheme, including javascript:, this field
    // gets rendered as a clickable <a href> to every other member, so a
    // non-http(s) URL here would be a stored-XSS vector.
    .refine((v) => /^https?:\/\//i.test(v), "Must be a http(s):// link")
    .optional(),
});

export async function createActivityAction(formData: FormData) {
  const user = await requireMember();
  const club = clubFor(user.club);

  const raw = {
    title: formData.get("title"),
    category: formData.get("category") || defaultCategoryFor(club.key),
    afterSpot: formData.get("afterSpot") || undefined,
    description: formData.get("description") || undefined,
    location: formData.get("location"),
    startsAt: formData.get("startsAt"),
    distanceKm: formData.get("distanceKm") || undefined,
    pace: formData.get("pace") || undefined,
    maxParticipants: formData.get("maxParticipants") || undefined,
    stravaUrl: formData.get("stravaUrl") || undefined,
  };
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    redirect(`/activities/new?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);
  }

  // The form only offers this club's categories, so anything else was
  // hand-posted. Checked here rather than trusted, or a Packmate could file
  // a gym session and a Pacemate a hostel night.
  const offered = categoriesForClub(club.key).map((c) => c.value as string);
  if (!offered.includes(parsed.data.category)) {
    redirect(
      `/activities/new?error=${encodeURIComponent(`That isn't something ${club.name} posts.`)}`
    );
  }

  const startsAt = new Date(parsed.data.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    redirect(`/activities/new?error=${encodeURIComponent("That date/time doesn't look right.")}`);
  }

  // Best-effort: a run still gets posted even if geocoding fails, it just
  // won't show up on the map view.
  const geocoded = await geocodeLocation(parsed.data.location);

  const prisma = await getPrisma();
  const activity = await prisma.runActivity.create({
    data: {
      // Copied from the host rather than taken from the form: which club a
      // meetup belongs to is never the poster's choice, it's who they are.
      club: user.club,
      hostId: user.id,
      title: parsed.data.title,
      category: parsed.data.category,
      afterSpot: parsed.data.afterSpot,
      description: parsed.data.description,
      location: parsed.data.location,
      latitude: geocoded?.latitude,
      longitude: geocoded?.longitude,
      startsAt,
      distanceKm: parsed.data.distanceKm,
      pace: parsed.data.pace,
      maxParticipants: parsed.data.maxParticipants,
      stravaUrl: parsed.data.stravaUrl,
      participations: {
        create: { userId: user.id, status: "JOINED" },
      },
    },
  });

  redirect(`/activities/${activity.id}`);
}

export async function joinActivityAction(formData: FormData) {
  const user = await requireMember();
  const activityId = String(formData.get("activityId"));

  const prisma = await getPrisma();
  const activity = await prisma.runActivity.findUnique({
    where: { id: activityId },
    include: { participations: { where: { status: "JOINED" } } },
  });
  // Same boundary as the detail page: nothing in the other club is
  // joinable, whatever id gets posted here.
  if (!activity || activity.club !== user.club) redirect("/activities");

  const alreadyIn = activity!.participations.some((p) => p.userId === user.id);
  const isFull =
    !!activity!.maxParticipants && activity!.participations.length >= activity!.maxParticipants;

  if (!alreadyIn) {
    await prisma.participation.upsert({
      where: { activityId_userId: { activityId, userId: user.id } },
      create: { activityId, userId: user.id, status: isFull ? "WAITLIST" : "JOINED" },
      update: { status: isFull ? "WAITLIST" : "JOINED" },
    });
  }

  redirect(`/activities/${activityId}`);
}

export async function leaveActivityAction(formData: FormData) {
  const user = await requireUser();
  const activityId = String(formData.get("activityId"));

  const prisma = await getPrisma();
  await prisma.participation.updateMany({
    where: { activityId, userId: user.id },
    data: { status: "CANCELLED" },
  });

  // Promote the earliest waitlisted person if a spot opened up.
  const activity = await prisma.runActivity.findUnique({ where: { id: activityId } });
  if (activity?.maxParticipants) {
    const joinedCount = await prisma.participation.count({
      where: { activityId, status: "JOINED" },
    });
    if (joinedCount < activity.maxParticipants) {
      const nextInLine = await prisma.participation.findFirst({
        where: { activityId, status: "WAITLIST" },
        orderBy: { joinedAt: "asc" },
      });
      if (nextInLine) {
        await prisma.participation.update({
          where: { id: nextInLine.id },
          data: { status: "JOINED" },
        });
      }
    }
  }

  redirect(`/activities/${activityId}`);
}

export async function postCommentAction(formData: FormData) {
  const user = await requireMember();
  const activityId = String(formData.get("activityId"));
  const body = String(formData.get("body") ?? "").trim();

  if (body.length === 0 || body.length > 1000) {
    redirect(`/activities/${activityId}?error=${encodeURIComponent("Message must be 1-1000 characters.")}`);
  }

  const prisma = await getPrisma();
  // The activity is looked up rather than trusted from the form: without
  // this, a posted id was enough to write into any meetup in either club.
  const activity = await prisma.runActivity.findUnique({
    where: { id: activityId },
    select: { club: true },
  });
  if (!activity || activity.club !== user.club) redirect("/activities");

  await prisma.comment.create({
    data: { activityId, authorId: user.id, body },
  });

  redirect(`/activities/${activityId}`);
}

export async function reportUserAction(formData: FormData) {
  const user = await requireUser();
  const reportedUserId = String(formData.get("reportedUserId"));
  const activityId = (formData.get("activityId") as string) || undefined;
  const reason = String(formData.get("reason") ?? "").trim();

  if (reportedUserId === user.id) {
    redirect(`/activities/${activityId}?error=${encodeURIComponent("You can't report yourself.")}`);
  }
  if (reason.length < 5) {
    redirect(
      `/activities/${activityId}?error=${encodeURIComponent("Please give a bit more detail in the report.")}`
    );
  }

  const prisma = await getPrisma();
  await prisma.report.create({
    data: { reporterId: user.id, reportedUserId, activityId, reason },
  });

  redirect(`/activities/${activityId}?reported=1`);
}
