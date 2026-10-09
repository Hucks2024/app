import type { PrismaClient } from "@prisma/client";

/** Says someone's going (or on the waitlist, if it's full), and where to
 * send them after. Shared by "I'm in" and the photo page, which finishes
 * the join for someone who had to add a photo first. */
export async function joinMeetup(prisma: PrismaClient, userId: string, activityId: string): Promise<string> {
  const activity = await prisma.runActivity.findUnique({
    where: { id: activityId },
    include: { participations: { where: { status: "JOINED" } } },
  });
  if (!activity) return "/activities";
  // Saying you're going to something that's over would count as having
  // been, which is what unlocks posting.
  if (activity.startsAt <= new Date() || activity.cancelledAt) return `/activities/${activityId}`;

  const alreadyIn = activity.participations.some((p) => p.userId === userId);
  const isFull = !!activity.maxParticipants && activity.participations.length >= activity.maxParticipants;

  if (!alreadyIn) {
    await prisma.participation.upsert({
      where: { activityId_userId: { activityId, userId } },
      create: { activityId, userId, status: isFull ? "WAITLIST" : "JOINED" },
      update: { status: isFull ? "WAITLIST" : "JOINED" },
    });
  }

  // Only flagged on the join that actually did something, so tapping a
  // page you're already on doesn't throw confetti at you.
  return `/activities/${activityId}${!alreadyIn && !isFull ? "?joined=1" : ""}`;
}
