import type { PrismaClient, User } from "@prisma/client";

// Signup is open, so trust is earned at meetups instead of at the door.
//
// A "verified member" (the ✓ by a name) is somebody who has been to a
// meetup run by another verified member. Only verified members can post
// meetups, so every meetup on the map is hosted by someone who has turned
// up to one before, and the chain runs back to the members from the
// invite-only days, who were verified when signup opened.
//
// Thumbs up are the other half: after a meetup, the people who were there
// can give each other a 👍, and everyone's count is shown next to their
// name. The tick says "has been to one", the count says "people were
// glad they came".

/** Has the ✓, and with it the + button. Admins always do. */
export function isVerifiedMember(user: Pick<User, "role" | "memberVerifiedAt">): boolean {
  return user.role === "ADMIN" || user.memberVerifiedAt != null;
}

/** Stamps the ✓ if it's been earned since we last looked, and says whether
 * it's there now and whether this was the moment it arrived.
 *
 * Earned means: said "I'm in" to a meetup that has now started, hosted by
 * somebody verified who isn't you and hasn't been suspended. Checked
 * lazily, on the pages where it matters, rather than by a job that runs
 * when meetups end, because there's nothing to run that job on. */
export async function refreshVerified(
  prisma: PrismaClient,
  user: Pick<User, "id" | "role" | "memberVerifiedAt">
): Promise<{ verified: boolean; justVerified: boolean }> {
  if (isVerifiedMember(user)) return { verified: true, justVerified: false };

  const attended = await prisma.participation.findFirst({
    where: {
      userId: user.id,
      status: "JOINED",
      activity: {
        startsAt: { lte: new Date() },
        cancelledAt: null,
        hostId: { not: user.id },
        host: {
          accountStatus: "ACTIVE",
          OR: [{ memberVerifiedAt: { not: null } }, { role: "ADMIN" }],
        },
      },
    },
    select: { id: true },
  });
  if (!attended) return { verified: false, justVerified: false };

  await prisma.user.update({ where: { id: user.id }, data: { memberVerifiedAt: new Date() } });
  return { verified: true, justVerified: true };
}

/** Everyone's 👍 total, for a set of people, in one query. Anyone with
 * none simply isn't in the map; read it with `?? 0`. */
export async function thumbsFor(
  prisma: PrismaClient,
  userIds: string[]
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const rows = await prisma.thumbsUp.groupBy({
    by: ["toId"],
    where: { toId: { in: [...new Set(userIds)] } },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.toId, r._count._all]));
}
