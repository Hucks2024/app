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

function randomCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/** Whatever someone typed, in canonical form: upper case, no spaces or dashes. */
export function normalizeCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** The member's own code to hand out, minted on first use. */
export async function ensureInviteCode(prisma: PrismaClient, userId: string): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { inviteCode: true },
  });
  if (existing?.inviteCode) return existing.inviteCode;

  // Retry on the (very unlikely) collision rather than pre-checking, the
  // unique index is the real arbiter.
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { inviteCode: code },
      });
      return updated.inviteCode!;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  throw new Error("Could not generate a unique invite code");
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
