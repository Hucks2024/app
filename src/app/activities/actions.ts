"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { requireUser, requireVerifiedUser } from "@/lib/auth";
import { geocodeLocation } from "@/lib/geocode";

const createSchema = z.object({
  title: z.string().trim().min(3, "Give your run a title").max(120),
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
  const user = await requireVerifiedUser();

  const raw = {
    title: formData.get("title"),
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
      hostId: user.id,
      title: parsed.data.title,
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
  const user = await requireVerifiedUser();
  const activityId = String(formData.get("activityId"));

  const prisma = await getPrisma();
  const activity = await prisma.runActivity.findUnique({
    where: { id: activityId },
    include: { participations: { where: { status: "JOINED" } } },
  });
  if (!activity) redirect("/activities");

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
  const user = await requireVerifiedUser();
  const activityId = String(formData.get("activityId"));
  const body = String(formData.get("body") ?? "").trim();

  if (body.length === 0 || body.length > 1000) {
    redirect(`/activities/${activityId}?error=${encodeURIComponent("Message must be 1-1000 characters.")}`);
  }

  const prisma = await getPrisma();
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
