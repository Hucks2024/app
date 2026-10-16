"use server";

import { redirect } from "next/navigation";
import { errorQuery } from "@/lib/flash";
import { joinMeetup } from "@/lib/join";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { refreshVerified } from "@/lib/trust";
import { banIfFlagged, promoteWaitlist } from "@/lib/moderation";
import { geocodeLocation } from "@/lib/geocode";
import { CATEGORY_VALUES, categoryFor } from "@/lib/categories";
import { NOT_NICE, NO_ADS, looksLikeAdvert, looksOffensive } from "@/lib/bots";
import { block } from "@/lib/blocks";
import { getT } from "@/i18n/server";
import { errorText, fill } from "@/i18n/format";

// Every box anyone can type in, checked for adverts (see src/lib/bots.ts).
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((v) => !looksLikeAdvert(v), NO_ADS)
    .refine((v) => !looksOffensive(v), NOT_NICE);

const createSchema = z.object({
  title: text(120).pipe(z.string().min(3, "giveName")),
  category: z
    .string()
    .refine((v) => CATEGORY_VALUES.includes(v), "pickType")
    .default("SOCIAL"),
  findUs: text(200).optional(),
  description: text(2000).optional(),
  location: text(200).pipe(z.string().min(3, "typeWhere")),
  startsAt: z.string().min(1, "pickDayTime"),
  pace: text(40).optional(),
});

export type MeetupFormState = { error: string | null };

/** What the form has typed in, as the schema wants it. */
function readMeetupForm(formData: FormData) {
  return {
    title: formData.get("title"),
    category: formData.get("category") || "SOCIAL",
    findUs: formData.get("findUs") || undefined,
    description: formData.get("description") || undefined,
    location: formData.get("location"),
    startsAt: formData.get("startsAt"),
    pace: formData.get("pace") || undefined,
  };
}


/** Posts a new meetup, or saves changes to one (when activityId is set).
 *
 * Errors come back as state, so the form stays filled in. And nothing is
 * saved without a pin: a meetup that isn't on the map is a meetup nobody
 * finds, so the host is asked to fix the place rather than finding out
 * later that nobody came. */
export async function saveMeetupAction(
  _prev: MeetupFormState,
  formData: FormData
): Promise<MeetupFormState> {
  const user = await requireUser();
  const [prisma, t] = await Promise.all([getPrisma(), getT()]);
  const editingId = String(formData.get("activityId") ?? "");

  const existing = editingId
    ? await prisma.runActivity.findUnique({ where: { id: editingId } })
    : null;
  if (editingId) {
    if (!existing || (existing.hostId !== user.id && user.role !== "ADMIN")) redirect("/");
    if (existing.cancelledAt) return { error: t.errors.meetupCancelled };
    if (existing.startsAt <= new Date()) return { error: t.errors.meetupStarted };
  } else if (!(await refreshVerified(prisma, user)).verified) {
    // Posting is for verified members: somebody who's been to a meetup
    // themselves. The page explains how to get there; this is the lock.
    redirect("/activities/new");
  } else if (!user.profilePhotoType) {
    // The host most of all: they're the one people look for first.
    redirect("/photo?next=/activities/new");
  }

  const parsed = createSchema.safeParse(readMeetupForm(formData));
  if (!parsed.success) return { error: errorText(t, parsed.error.issues[0]?.message) };

  // The picker gives a wall-clock time with no zone ("2026-10-04T07:00"),
  // which the server would read as UTC: an hour out all summer in London.
  // The form also sends the same moment as the browser understood it, in
  // its own zone, and that's the one we keep when it's there.
  const fromBrowser = String(formData.get("startsAtUtc") ?? "");
  const startsAt = new Date(fromBrowser || parsed.data.startsAt);
  if (Number.isNaN(startsAt.getTime())) return { error: t.errors.checkDayTime };
  if (startsAt.getTime() < Date.now() - 5 * 60 * 1000) {
    return { error: t.when.gone };
  }

  // Where the pin goes. The form found it from the host's own browser
  // when it could (placeFor says which text that was for, so a pin left
  // over from an earlier version of the box is never used); otherwise an
  // unchanged place keeps its pin, and anything else is looked up here.
  let latitude = existing?.latitude ?? null;
  let longitude = existing?.longitude ?? null;
  const fromForm = {
    lat: Number(formData.get("latitude")),
    lng: Number(formData.get("longitude")),
    for: String(formData.get("placeFor") ?? ""),
  };
  if (
    fromForm.for === parsed.data.location &&
    formData.get("latitude") &&
    Math.abs(fromForm.lat) <= 90 &&
    Math.abs(fromForm.lng) <= 180
  ) {
    latitude = fromForm.lat;
    longitude = fromForm.lng;
  } else if (!existing || existing.location !== parsed.data.location || latitude == null) {
    const place = await geocodeLocation(parsed.data.location);
    if (place.status === "not_found") return { error: fill(t.errors.placeNotFound, { place: parsed.data.location }) };
    if (place.status === "unavailable") return { error: t.errors.lookupDown };
    latitude = place.latitude;
    longitude = place.longitude;
  }

  // Only a run, a ride and the like keep a pace, distance and route. The
  // form asks for the pace alone now: a distance, a Strava route, a place
  // to go after and a cap are kept as an older meetup had them, and new
  // ones have none.
  const route = categoryFor(parsed.data.category).route;
  const fields = {
    title: parsed.data.title,
    category: parsed.data.category,
    afterSpot: existing?.afterSpot ?? null,
    findUs: parsed.data.findUs ?? null,
    description: parsed.data.description ?? null,
    location: parsed.data.location,
    latitude,
    longitude,
    startsAt,
    distanceKm: route ? (existing?.distanceKm ?? null) : null,
    pace: route ? (parsed.data.pace ?? null) : null,
    maxParticipants: existing?.maxParticipants ?? null,
    stravaUrl: route ? (existing?.stravaUrl ?? null) : null,
  };

  if (existing) {
    await prisma.runActivity.update({ where: { id: existing.id }, data: fields });
    redirect(`/activities/${existing.id}?saved=1`);
  }

  const activity = await prisma.runActivity.create({
    data: {
      ...fields,
      hostId: user.id,
      participations: { create: { userId: user.id, status: "JOINED" } },
    },
  });
  redirect(`/activities/${activity.id}`);
}

/** Calls a meetup off. The host or an admin, any time before it starts.
 * It comes off the map at once, and the people going see it marked
 * cancelled rather than finding it gone. */
export async function cancelActivityAction(formData: FormData) {
  const user = await requireUser();
  const activityId = String(formData.get("activityId"));
  const prisma = await getPrisma();
  const activity = await prisma.runActivity.findUnique({ where: { id: activityId } });
  if (!activity || (activity.hostId !== user.id && user.role !== "ADMIN")) redirect("/");
  if (!activity.cancelledAt && activity.startsAt > new Date()) {
    await prisma.runActivity.update({ where: { id: activityId }, data: { cancelledAt: new Date() } });
  }
  redirect(`/activities/${activityId}`);
}

export async function joinActivityAction(formData: FormData) {
  const user = await requireUser();
  const activityId = String(formData.get("activityId"));
  // Everyone going has a face on the meetup, so the group knows who to
  // look out for: no photo, no place. The photo page finishes the join.
  if (!user.profilePhotoType) redirect(`/photo?join=${encodeURIComponent(activityId)}`);
  redirect(await joinMeetup(await getPrisma(), user.id, activityId));
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
  const user = await requireUser();
  const activityId = String(formData.get("activityId"));
  const toId = String(formData.get("toId"));
  if (toId === user.id) return;

  const prisma = await getPrisma();
  const activity = await prisma.runActivity.findUnique({
    where: { id: activityId },
    select: {
      startsAt: true,
      cancelledAt: true,
      participations: {
        where: { status: "JOINED", userId: { in: [user.id, toId] } },
        select: { userId: true },
      },
    },
  });
  if (!activity || activity.startsAt > new Date() || activity.cancelledAt) return;
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
  const user = await requireUser();
  const reportedUserId = String(formData.get("reportedUserId"));
  const activityId = String(formData.get("activityId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const back = (query: string) => redirect(`/activities/${activityId}?${query}`);
  const t = await getT();

  if (reportedUserId === user.id) {
    back(errorQuery(t.errors.reportSelf));
  }
  if (reason.length < 5) {
    back(errorQuery(t.errors.sayWhat));
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

/** Block someone, from a meetup page. See src/lib/blocks.ts. */
export async function blockUserAction(formData: FormData) {
  const user = await requireUser();
  const blockedId = String(formData.get("blockedId"));
  const activityId = String(formData.get("activityId") ?? "");
  if (blockedId === user.id) redirect(`/activities/${activityId}?${errorQuery((await getT()).errors.blockSelf)}`);

  const prisma = await getPrisma();
  const [blocked, activity] = await Promise.all([
    prisma.user.findUnique({ where: { id: blockedId }, select: { id: true } }),
    prisma.runActivity.findUnique({ where: { id: activityId }, select: { hostId: true } }),
  ]);
  if (!blocked) redirect("/");

  await block(prisma, user.id, blockedId);
  revalidatePath("/");
  // Their own meetup is hidden from you now, so there's nothing to go
  // back to; Me shows who you've blocked, and undoes it.
  if (!activity || activity.hostId === blockedId) redirect("/profile?blocked=1#blocked");
  redirect(`/activities/${activityId}?blocked=1`);
}
