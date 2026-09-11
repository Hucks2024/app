import { Prisma, type PrismaClient, type User } from "@prisma/client";

// No 0/O/1/I/L in the alphabet: these codes get read out loud, typed off a
// screenshot and scribbled on paper, so the ambiguous characters simply
// aren't in the set rather than being something we try to untangle later.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

// How many people a normal member can bring in. Admins are exempt. The cap
// is what stops one code, posted publicly, from turning invite-only into
// open signup.
export const DEFAULT_INVITES = 5;

function randomPart(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/** "42" -> "000042". Shown on profiles as #000042. */
export function formatMemberNumber(n: number): string {
  return String(n).padStart(6, "0");
}

/** A member's code: eight random characters, e.g. "X43TPRGY".
 *
 * Deliberately not the membership number. Numbers run 1, 2, 3, so a code
 * that was the number would let anyone count their way in. Eight characters
 * from a 31-letter alphabet is about 853 billion possibilities, which is
 * what makes this a credential; the number lives on the profile instead,
 * where being guessable doesn't matter. */
function buildCode(): string {
  return randomPart();
}

/** Whatever someone typed, in canonical form: upper case, letters and
 * digits only, and just the last CODE_LENGTH of them.
 *
 * Taking the tail is what lets an older code still work: codes used to be
 * issued as "000042-X43TPRGY", and trimming to the last eight accepts that
 * form and the current short one through the same path. */
export function normalizeCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(-CODE_LENGTH);
}

export type Membership = { memberNumber: number; inviteCode: string };

/** The member's number and the code they hand out, minted on first use.
 *
 * Both at once because the code is built from the number. Numbers are
 * handed out by taking the highest so far and adding one; if two signups
 * race for the same one the unique index rejects the loser and the retry
 * picks up the next. */
export async function ensureMembership(
  prisma: PrismaClient,
  userId: string
): Promise<Membership> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { memberNumber: true, inviteCode: true },
  });
  if (existing?.memberNumber != null && existing.inviteCode) {
    return { memberNumber: existing.memberNumber, inviteCode: existing.inviteCode };
  }

  for (let attempt = 0; attempt < 10; attempt++) {
    const highest = await prisma.user.findFirst({
      where: { memberNumber: { not: null } },
      orderBy: { memberNumber: "desc" },
      select: { memberNumber: true },
    });
    const memberNumber = existing?.memberNumber ?? (highest?.memberNumber ?? 0) + 1;
    const inviteCode = buildCode();
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { memberNumber, inviteCode },
      });
      return { memberNumber: updated.memberNumber!, inviteCode: updated.inviteCode! };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  throw new Error("Could not assign a membership number");
}

export type InviteCheck = { ok: true; inviter: User } | { ok: false; reason: string };

/** Looks up who a code belongs to and whether it can still be spent. */
export async function checkInviteCode(
  prisma: PrismaClient,
  rawCode: string
): Promise<InviteCheck> {
  const code = normalizeCode(rawCode);
  if (!code) {
    return { ok: false, reason: "Enter the invite code from the member who invited you." };
  }

  const inviter = await prisma.user.findUnique({ where: { inviteCode: code } });
  if (!inviter) {
    return {
      ok: false,
      reason: "That code isn't valid. Check it with whoever invited you.",
    };
  }
  if (inviter.accountStatus === "SUSPENDED") {
    return { ok: false, reason: "That code is no longer active." };
  }
  if (inviter.role !== "ADMIN" && inviter.invitesLeft <= 0) {
    return {
      ok: false,
      reason: "That code has been used up. Ask whoever invited you for a fresh one.",
    };
  }
  return { ok: true, inviter };
}

/** Spends one invite off the inviter's allowance. Admin codes never run out. */
export async function spendInvite(prisma: PrismaClient, inviter: User): Promise<void> {
  if (inviter.role === "ADMIN") return;
  // Conditional decrement so two people racing for the last invite can't
  // push the count negative, whoever loses simply finds the code used up.
  await prisma.user.updateMany({
    where: { id: inviter.id, invitesLeft: { gt: 0 } },
    data: { invitesLeft: { decrement: 1 } },
  });
}
