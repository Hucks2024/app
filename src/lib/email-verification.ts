import { randomInt } from "crypto";
import type { PrismaClient } from "@prisma/client";
import { sendEmail } from "@/lib/email";
import { SITE } from "@/lib/site";

const CODE_TTL_MINUTES = 15;
const MAX_ATTEMPTS = 5;
// How long before a new code can be requested. Stops the resend button
// being used to hammer someone's inbox.
const RESEND_COOLDOWN_SECONDS = 60;

function sixDigits(): string {
  // randomInt, not Math.random: this is the only thing standing between an
  // email address and an account, so it should come from a real CSPRNG.
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Issues a fresh code and emails it. Replaces any code already out. */
export async function sendVerificationCode(
  prisma: PrismaClient,
  user: { id: string; email: string; name: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await prisma.emailVerification.findUnique({ where: { userId: user.id } });
  if (existing) {
    const secondsSince = (Date.now() - existing.sentAt.getTime()) / 1000;
    if (secondsSince < RESEND_COOLDOWN_SECONDS) {
      const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSince);
      return { ok: false, error: `Hang on ${wait} more second${wait === 1 ? "" : "s"} before asking for another code.` };
    }
  }

  const code = sixDigits();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

  const result = await sendEmail({
    to: user.email,
    subject: `${code} is your ${SITE.name} code`,
    text: [
      `Hi ${user.name},`,
      ``,
      `Your ${SITE.name} verification code is:`,
      ``,
      `    ${code}`,
      ``,
      `It expires in ${CODE_TTL_MINUTES} minutes.`,
      ``,
      `If you didn't try to join ${SITE.name}, you can ignore this, nobody can use`,
      `the code but you.`,
    ].join("\n"),
  });

  // Only record the code once the email is actually away. Storing it after
  // a failed send would start the clock (and the cooldown) on a code that
  // never reached anyone.
  if (!result.ok) return result;

  await prisma.emailVerification.upsert({
    where: { userId: user.id },
    create: { userId: user.id, code, expiresAt },
    update: { code, expiresAt, attempts: 0, sentAt: new Date() },
  });

  return { ok: true };
}

export type CheckResult = { ok: true } | { ok: false; error: string };

/** Checks a typed code and, if it's right, marks the email verified. */
export async function checkVerificationCode(
  prisma: PrismaClient,
  userId: string,
  typed: string
): Promise<CheckResult> {
  const code = typed.replace(/\D/g, "");
  if (code.length !== 6) {
    return { ok: false, error: "Enter the six digits from the email." };
  }

  const record = await prisma.emailVerification.findUnique({ where: { userId } });
  if (!record) {
    return { ok: false, error: "That code has expired. Ask for a new one." };
  }
  if (record.expiresAt < new Date()) {
    await prisma.emailVerification.delete({ where: { userId } });
    return { ok: false, error: "That code has expired. Ask for a new one." };
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: "Too many wrong tries. Ask for a new code." };
  }

  if (record.code !== code) {
    const attempts = record.attempts + 1;
    await prisma.emailVerification.update({ where: { userId }, data: { attempts } });
    const left = MAX_ATTEMPTS - attempts;
    return {
      ok: false,
      error: left > 0
        ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.`
        : "Too many wrong tries. Ask for a new code.",
    };
  }

  // Right code: stamp the account and throw the code away so it can't be
  // replayed.
  await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  await prisma.emailVerification.delete({ where: { userId } });
  return { ok: true };
}
