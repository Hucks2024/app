import type { PrismaClient, User } from "@prisma/client";

// Five wrong passwords in a row and the account waits fifteen minutes.
// That's nothing to someone who mistyped, and it turns guessing a password
// by trying thousands of them into a job that would take years. A right
// password, or a reset, clears the count.

export const MAX_TRIES = 5;
const LOCK_MINUTES = 15;

/** Minutes left on a lock, or 0 if the account is open. */
export function minutesLocked(user: Pick<User, "lockedUntil">): number {
  if (!user.lockedUntil) return 0;
  const ms = user.lockedUntil.getTime() - Date.now();
  return ms > 0 ? Math.ceil(ms / 60000) : 0;
}

/** Counts a wrong password. Returns how many tries are left before the
 * lock, or 0 if this one locked it. */
export async function recordWrongPassword(
  prisma: PrismaClient,
  user: Pick<User, "id" | "failedLogins" | "lockedUntil">
): Promise<number> {
  // A lock that has run out starts the count again from nothing.
  const lockExpired = user.lockedUntil != null && user.lockedUntil.getTime() <= Date.now();
  const failed = (lockExpired ? 0 : user.failedLogins) + 1;
  if (failed >= MAX_TRIES) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60000) },
    });
    return 0;
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLogins: failed, lockedUntil: null },
  });
  return MAX_TRIES - failed;
}

export async function clearWrongPasswords(prisma: PrismaClient, userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLogins: 0, lockedUntil: null },
  });
}
