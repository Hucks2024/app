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

/** A member's code: their membership number, then a random half.
 *
 * The number on its own could never be the code. Membership numbers run
 * 1, 2, 3... so a code that *was* the number would let anyone count their
 * way in and invite-only would mean nothing. The random half is what makes
 * it a credential, roughly 887 million possibilities per number, while the
 * visible number still ties every code to the member who owns it. */
function buildCode(memberNumber: number): string {
  return `${formatMemberNumber(memberNumber)}-${randomPart()}`;
}

/** Whatever someone typed, in canonical form: upper case, no spaces, no dashes. */
export function normalizeCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
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
    const inviteCode = buildCode(memberNumber);
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

/** Finds the owner of a code, ignoring the dash and any typed-in casing. */
async function findByNormalizedCode(prisma: PrismaClient, normalized: string) {
  const direct = await prisma.user.findUnique({ where: { inviteCode: normalized } });
  if (direct) return direct;

  // The canonical stored form is "NNNNNN-RRRRRR"; rebuild it from the
  // normalized digits+letters rather than scanning every member.
  if (normalized.length !== 6 + CODE_LENGTH) return null;
  const dashed = `${normalized.slice(0, 6)}-${normalized.slice(6)}`;
  return prisma.user.findUnique({ where: { inviteCode: dashed } });
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

  // Stored codes carry a dash ("000042-K7M2QX") that normalizeCode strips,
  // so match on the normalized form rather than the raw column.
  const inviter = await findByNormalizedCode(prisma, code);
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
