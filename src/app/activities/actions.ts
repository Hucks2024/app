"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { requireUser, requireMember } from "@/lib/auth";
import { refreshVerified } from "@/lib/trust";
import { banIfFlagged, promoteWaitlist } from "@/lib/moderation";
import { geocodeLocation } from "@/lib/geocode";
import { CATEGORY_VALUES } from "@/lib/categories";

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
  const prisma = await getPrisma();

  // Posting is for verified members: somebody who's been to a meetup
  // themselves. The page explains how to get there; this is the lock.
  if (!(await refreshVerified(prisma, user)).verified) {
    redirect("/activities/new");
  }

  const raw = {
    title: formData.get("title"),
    category: formData.get("category") || "RUN",
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

  // The picker gives a wall-clock time with no zone ("2026-10-04T07:00"),
  // which the server would read as UTC: an hour out all summer in London.
  // The form also sends the same moment as the browser understood it, in
  // its own zone, and that's the one we keep when it's there.
  const fromBrowser = String(formData.get("startsAtUtc") ?? "");
  const startsAt = new Date(fromBrowser || parsed.data.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    redirect(`/activities/new?error=${encodeURIComponent("That date/time doesn't look right.")}`);
  }
  if (startsAt.getTime() < Date.now() - 5 * 60 * 1000) {
    redirect(`/activities/new?error=${encodeURIComponent("That time has already gone. Pick one in the future.")}`);
  }

  // Best-effort: a run still gets posted even if geocoding fails, it just
  // won't show up on the map view.
  const geocoded = await geocodeLocation(parsed.data.location);

  const activity = await prisma.runActivity.create({
    data: {
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
  if (!activity) redirect("/activities");
  // Saying you're going to something that's over would count as having
  // been, which is what unlocks posting.
  if (activity!.startsAt <= new Date()) redirect(`/activities/${activityId}`);

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

  // Only flagged on the join that actually did something, so tapping a
  // page you're already on doesn't throw confetti at you.
  const celebrate = !alreadyIn && !isFull ? "?joined=1" : "";
  redirect(`/activities/${activityId}${celebrate}`);
}

export async function leaveActivityAction(formData: FormData) {
  const user = await requireUser();
  const activityId = String(formData.get("activityId"));

  const prisma = await getPrisma();
  // Once it's started, who went is history, and history is what thumbs up
  // and the verified tick are built on: no un-going afterwards.
  await prisma.participation.updateMany({
    where: { activityId, userId: user.id, activity: { startsAt: { gt: new Date() } } },
    data: { status: "CANCELLED" },
  });

  await promoteWaitlist(prisma, activityId);

  redirect(`/activities/${activityId}`);
}

/** 👍 for somebody you were at a meetup with, or take it back.
 *
 * Only after the meetup has started, only between two people who were both
 * going, and never yourself: the count is meant to mean "somebody who met
 * them was glad they came". No redirect, so the page just refreshes in
 * place with the new numbers. */
export async function toggleThumbsUpAction(formData: FormData) {
  const user = await requireMember();
  const activityId = String(formData.get("activityId"));
  const toId = String(formData.get("toId"));
  if (toId === user.id) return;

  const prisma = await getPrisma();
  const activity = await prisma.runActivity.findUnique({
    where: { id: activityId },
    select: {
      startsAt: true,
      participations: {
        where: { status: "JOINED", userId: { in: [user.id, toId] } },
        select: { userId: true },
      },
    },
  });
  if (!activity || activity.startsAt > new Date()) return;
  if (activity.participations.length !== 2) return;

  const key = { activityId_fromId_toId: { activityId, fromId: user.id, toId } };
  const existing = await prisma.thumbsUp.findUnique({ where: key });
  if (existing) {
    await prisma.thumbsUp.delete({ where: key });
  } else {
    await prisma.thumbsUp.create({ data: { activityId, fromId: user.id, toId } });
  }

  revalidatePath(`/activities/${activityId}`);
}

/** A 🚩 red flag. Always reaches the admins; counts towards the
 * three-strikes ban when it's about somebody you were at a meetup with
 * (see src/lib/moderation.ts), and the third such flag bans them on the
 * spot rather than waiting for an admin to get round to it. */
export async function reportUserAction(formData: FormData) {
  const user = await requireMember();
  const reportedUserId = String(formData.get("reportedUserId"));
  const activityId = String(formData.get("activityId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const back = (query: string) => redirect(`/activities/${activityId}?${query}`);

  if (reportedUserId === user.id) {
    back(`error=${encodeURIComponent("You can't red-flag yourself.")}`);
  }
  if (reason.length < 5) {
    back(`error=${encodeURIComponent("Say a bit more about what happened, so a moderator can act on it.")}`);
  }

  const prisma = await getPrisma();
  // Both looked up rather than trusted from the form: a made-up id would
  // otherwise be a crash, or a flag against nobody.
  const [reported, activity] = await Promise.all([
    prisma.user.findUnique({ where: { id: reportedUserId }, select: { id: true } }),
    prisma.runActivity.findUnique({ where: { id: activityId }, select: { id: true } }),
  ]);
  if (!reported || !activity) redirect("/");

  await prisma.report.create({
    data: { reporterId: user.id, reportedUserId, activityId, reason: reason.slice(0, 1000) },
  });
  await banIfFlagged(prisma, reportedUserId);

  back("reported=1");
}
