import type { PrismaClient } from "@prisma/client";

// Three red flags and you're out for good.
//
// A red flag is the 🚩 on a meetup page. Anyone can raise one about anyone
// at any time, and every one lands on /admin, but only some count towards
// the automatic ban, because signup is open and a ban that three throwaway
// accounts could hand out would be a weapon rather than a safeguard. A
// flag counts when:
//
//   - it was raised about somebody at a meetup the two of you were both
//     going to, after that meetup had started, so it's about something
//     that happened in person, and
//   - it's the first counted flag from that person: three flags from one
//     angry member are one flag.
//
// Admins can't be flagged out, and an admin can lift a ban on /admin if
// one ever turns out to be wrong.

export const RED_FLAG_LIMIT = 3;

/** How many different people have red-flagged this member after meeting
 * them at a meetup. */
export async function redFlagCount(prisma: PrismaClient, userId: string): Promise<number> {
  const flags = await prisma.report.findMany({
    where: { reportedUserId: userId, activityId: { not: null } },
    select: { reporterId: true, activityId: true, createdAt: true },
  });
  if (flags.length === 0) return 0;

  // Every meetup these flags were raised at, with which of the two people
  // were going to it.
  const activities = await prisma.runActivity.findMany({
    // A meetup that was called off never happened, so it can't be where
    // anything happened.
    where: { id: { in: [...new Set(flags.map((f) => f.activityId!))] }, cancelledAt: null },
    select: {
      id: true,
      startsAt: true,
      participations: {
        where: { status: "JOINED" },
        select: { userId: true },
      },
    },
  });
  const byId = new Map(activities.map((a) => [a.id, a]));

  const counted = new Set<string>();
  for (const f of flags) {
    const a = byId.get(f.activityId!);
    if (!a || f.createdAt < a.startsAt) continue;
    const going = new Set(a.participations.map((p) => p.userId));
    if (going.has(f.reporterId) && going.has(userId)) counted.add(f.reporterId);
  }
  return counted.size;
}

/** Bans this member for good if they've reached the limit. Returns whether
 * they're banned now. */
export async function banIfFlagged(prisma: PrismaClient, userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, accountStatus: true },
  });
  if (!user || user.role === "ADMIN") return false;
  if (user.accountStatus === "BANNED") return true;
  if ((await redFlagCount(prisma, userId)) < RED_FLAG_LIMIT) return false;

  await prisma.user.update({ where: { id: userId }, data: { accountStatus: "BANNED" } });

  // Off everything still to come, so nobody turns up to meet them, and
  // whoever was first on each waitlist gets their place. Meetups they
  // were hosting drop off the map on their own (see liveMeetup in
  // src/lib/meetups.ts).
  const upcoming = await prisma.participation.findMany({
    where: {
      userId,
      status: { in: ["JOINED", "WAITLIST"] },
      activity: { startsAt: { gt: new Date() } },
    },
    select: { id: true, activityId: true },
  });
  for (const p of upcoming) {
    await prisma.participation.update({ where: { id: p.id }, data: { status: "CANCELLED" } });
    await promoteWaitlist(prisma, p.activityId);
  }
  return true;
}

/** If a meetup with a cap has room, the earliest person waiting gets in. */
export async function promoteWaitlist(prisma: PrismaClient, activityId: string): Promise<void> {
  const activity = await prisma.runActivity.findUnique({
    where: { id: activityId },
    select: { maxParticipants: true },
  });
  if (!activity?.maxParticipants) return;
  const joined = await prisma.participation.count({ where: { activityId, status: "JOINED" } });
  if (joined >= activity.maxParticipants) return;
  const next = await prisma.participation.findFirst({
    where: { activityId, status: "WAITLIST" },
    orderBy: { joinedAt: "asc" },
  });
  if (next) {
    await prisma.participation.update({ where: { id: next.id }, data: { status: "JOINED" } });
  }
}
