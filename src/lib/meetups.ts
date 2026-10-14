import type { PrismaClient } from "@prisma/client";

// Which meetups are "on": not called off, and run by somebody who's still
// allowed in. A cancelled meetup, or one whose host has been banned or
// suspended, comes off the map, the list and every count at once, and
// doesn't count for thumbs up, red flags or unlocking posting either,
// because it didn't happen.
export const liveMeetup = {
  cancelledAt: null,
  host: { accountStatus: "ACTIVE" },
} as const;

/** How many are going to each of these meetups, in one query. A meetup
 * nobody's going to is left out; read it with `?? 0`.
 *
 * Asked for by id rather than with Prisma's `_count`, which counts every
 * sign-up in the database to answer for a handful of meetups. */
export async function goingCounts(prisma: PrismaClient, activityIds: string[]): Promise<Map<string, number>> {
  if (activityIds.length === 0) return new Map();
  const rows = await prisma.participation.groupBy({
    by: ["activityId"],
    where: { activityId: { in: activityIds }, status: "JOINED" },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.activityId, r._count._all]));
}
