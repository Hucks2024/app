import type { PrismaClient } from "@prisma/client";
import { promoteWaitlist } from "@/lib/moderation";

// Blocking someone: from then on neither of you sees the other's meetups
// or the other on a meetup's list of who's going, and neither can join a
// meetup the other is hosting. It works both ways so a block can't be
// watched from the other side. Only the blocker can undo it, on Me.

/** Everyone this member has blocked or been blocked by. */
export async function blockedEitherWay(prisma: PrismaClient, userId: string): Promise<Set<string>> {
  const rows = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  return new Set(rows.map((r) => (r.blockerId === userId ? r.blockedId : r.blockerId)));
}

export async function isBlockedEitherWay(prisma: PrismaClient, a: string, b: string): Promise<boolean> {
  const row = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    select: { id: true },
  });
  return row != null;
}

/** Blocks them, and takes each of you off the other's meetups still to
 * come, so neither turns up to meet the other. */
export async function block(prisma: PrismaClient, blockerId: string, blockedId: string): Promise<void> {
  await prisma.block.upsert({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    create: { blockerId, blockedId },
    update: {},
  });

  const shared = await prisma.participation.findMany({
    where: {
      status: { in: ["JOINED", "WAITLIST"] },
      activity: { startsAt: { gt: new Date() } },
      OR: [
        { userId: blockedId, activity: { hostId: blockerId } },
        { userId: blockerId, activity: { hostId: blockedId } },
      ],
    },
    select: { id: true, activityId: true },
  });
  if (shared.length === 0) return;
  await prisma.participation.updateMany({
    where: { id: { in: shared.map((p) => p.id) } },
    data: { status: "CANCELLED" },
  });
  for (const activityId of new Set(shared.map((p) => p.activityId))) {
    await promoteWaitlist(prisma, activityId);
  }
}
