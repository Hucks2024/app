"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/db";
import {
  createSession,
  destroySession,
  hashPassword,
  passwordChangeStamp,
  safeNext,
  verifyPassword,
} from "@/lib/auth";
import { ensureMemberNumber } from "@/lib/member";
import { canSendEmail, isTemporaryEmailError } from "@/lib/email";
import { checkResetCode, sendResetCode } from "@/lib/reset-code";
import { clearWrongPasswords, minutesLocked, recordWrongPassword } from "@/lib/lockout";
import {
  NO_ADS,
  isThrowawayEmail,
  issueSignupTicket,
  looksLikeAdvert,
  signupTicketOk,
} from "@/lib/bots";

// One way in for email, in two steps: the address first, then either the
// password (we know you) or a name and a new password (we don't). Nobody
// has to decide between "log in" and "sign up" before they've typed
// anything, and a mistyped address shows up as "create your account"
// instead of as a mystery second account later.

const emailSchema = z.string().trim().toLowerCase().email("Check the email address.");
const THROWAWAY = "Use your own email, not a throwaway one.";
const NOT_NOW = "Something went wrong. Try again.";

export type EmailLookup =
  | { kind: "existing"; provider: "apple" | "google" | null }
  | { kind: "new"; ticket: string }
  | { kind: "invalid"; error: string };

/** Step one: is there an account at this address? */
export async function lookupEmailAction(raw: string): Promise<EmailLookup> {
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) return { kind: "invalid", error: parsed.error.issues[0].message };

  const prisma = await getPrisma();
  const user = await prisma.user.findUnique({
    where: { email: parsed.data },
    select: { appleSub: true, googleSub: true },
  });
  if (!user) {
    if (isThrowawayEmail(parsed.data)) return { kind: "invalid", error: THROWAWAY };
    return { kind: "new", ticket: issueSignupTicket(parsed.data) };
  }
  // Said up front, so somebody who joined with a button doesn't sit there
  // guessing at a password they never had.
  return {
    kind: "existing",
    provider: user.appleSub ? "apple" : user.googleSub ? "google" : null,
  };
}

export type AuthState = { error: string | null };

const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Type your first name.")
    .max(80)
    .refine((v) => !looksLikeAdvert(v), NO_ADS),
  email: emailSchema,
  password: z.string().min(8, "Password: 8 or more characters."),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Type your password."),
});

/** Step two, either way round. Errors come back as state rather than a
 * redirect, so a wrong password is a line of red under the box and not a
 * reload that empties the form. */
export async function emailAuthAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const prisma = await getPrisma();

  if (formData.get("mode") === "signup") {
    // A field people never see, so only a bot filling in every box
    // fills it in. Turned away with nothing that says why.
    if (String(formData.get("website") ?? "").length > 0) {
      return { error: NOT_NOW };
    }
    const parsed = signupSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { name, email, password } = parsed.data;
    if (isThrowawayEmail(email)) return { error: THROWAWAY };
    // Proof the form was filled in by hand (see src/lib/bots.ts).
    if (!signupTicketOk(String(formData.get("ticket") ?? ""), email)) {
      return { error: NOT_NOW };
    }

    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      return { error: "That email already has an account. Go back and sign in." };
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        // No code to confirm the address: the app emails nobody except to
        // reset a password, so joining is straight in.
        emailVerifiedAt: new Date(),
      },
    });
    await ensureMemberNumber(prisma, user.id);
    await createSession(user.id);
    redirect(safeNext(formData.get("next")));
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { error: "Wrong password. Try again." };

  const locked = minutesLocked(user);
  if (locked > 0) {
    return {
      error: `Too many tries. Wait ${locked} minute${locked === 1 ? "" : "s"}.`,
    };
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    const left = await recordWrongPassword(prisma, user);
    if (left === 0) {
      return { error: "Too many tries. Wait 15 minutes." };
    }
    return {
      error:
        left <= 2
          ? `Wrong password. ${left} ${left === 1 ? "try" : "tries"} left.`
          : "Wrong password. Try again.",
    };
  }
  if (user.failedLogins > 0) await clearWrongPasswords(prisma, user.id);
  if (user.accountStatus === "BANNED") {
    return { error: "This account is banned for life." };
  }
  if (user.accountStatus !== "ACTIVE") {
    return { error: "This account is on hold." };
  }

  await createSession(user.id);
  redirect(safeNext(formData.get("next")));
}

/** Forgot your password, step one: email a code to the address. Only
 * possible when email is set up; the screen says so when it isn't. */
export async function startResetAction(raw: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!canSendEmail()) {
    return { ok: false, error: "Ask an admin to reset it." };
  }
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const prisma = await getPrisma();
  const user = await prisma.user.findUnique({ where: { email: parsed.data } });
  // Nothing goes to an address with no account, or to a banned one, but
  // the screen looks the same either way.
  if (!user || user.accountStatus !== "ACTIVE") return { ok: true };

  const sent = await sendResetCode(prisma, user);
  if (!sent.ok) {
    // Into Vercel's logs; the Email steps on /admin say the same thing in
    // plain words.
    console.error("Password reset email failed:", sent.error);
    // The cooldown message is worth showing; a provider error isn't. And
    // "try again" only when trying again could help: a setup problem
    // fails every time, so that sends them to someone who can help.
    return {
      ok: false,
      error: sent.error.startsWith("Wait")
        ? sent.error
        : isTemporaryEmailError(sent.error)
          ? "Email didn't send. Try again in a minute."
          : "Email isn't working yet. Ask an admin to reset your password.",
    };
  }
  return { ok: true };
}

const resetSchema = z.object({
  email: emailSchema,
  code: z.string().trim().min(1, "Type the code from the email."),
  password: z.string().min(8, "Password: 8 or more characters."),
});

/** Forgot your password, step two: the code from the email and a new
 * password, and you're signed in. Every other session ends. */
export async function finishResetAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = resetSchema.safeParse({
    email: formData.get("email"),
    code: formData.get("code"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const prisma = await getPrisma();
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || user.accountStatus !== "ACTIVE") {
    return { error: "Code expired. Get a new one." };
  }
  const checked = await checkResetCode(prisma, user.id, parsed.data.code);
  if (!checked.ok) return { error: checked.error };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.data.password),
      passwordChangedAt: passwordChangeStamp(),
      failedLogins: 0,
      lockedUntil: null,
    },
  });
  await createSession(user.id);
  // Home sorts out anything still owed (the code just confirmed the
  // address, so it won't be that).
  redirect(safeNext(formData.get("next")));
}


export async function logoutAction() {
  await destroySession();
  redirect("/");
}
