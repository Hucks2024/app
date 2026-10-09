import { Prisma, type PrismaClient } from "@prisma/client";

/** "42" -> "000042". Shown on the Me page as Member #000042. */
export function formatMemberNumber(n: number): string {
  return String(n).padStart(6, "0");
}

/** The member's number, given on first use: the highest so far plus one.
 * If two people join at once the unique index turns one away and the
 * retry takes the next number. */
export async function ensureMemberNumber(prisma: PrismaClient, userId: string): Promise<number> {
  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { memberNumber: true } });
  if (existing?.memberNumber != null) return existing.memberNumber;

  for (let attempt = 0; attempt < 10; attempt++) {
    const highest = await prisma.user.findFirst({
      where: { memberNumber: { not: null } },
      orderBy: { memberNumber: "desc" },
      select: { memberNumber: true },
    });
    const memberNumber = (highest?.memberNumber ?? 0) + 1;
    try {
      await prisma.user.update({ where: { id: userId }, data: { memberNumber } });
      return memberNumber;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  throw new Error("Could not give out a member number");
}
