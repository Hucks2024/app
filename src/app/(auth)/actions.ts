"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/db";
import {
  createSession,
  destroySession,
  hashPassword,
  isPaidUp,
  needsEmailCheck,
  verifyPassword,
} from "@/lib/auth";
import { ensureMembership } from "@/lib/invite";
import { emailVerificationEnabled } from "@/lib/email";
import { sendVerificationCode } from "@/lib/email-verification";

// One way in for email, in two steps: the address first, then either the
// password (we know you) or a name and a new password (we don't). Nobody
// has to decide between "log in" and "sign up" before they've typed
// anything, and a mistyped address shows up as "create your account"
// instead of as a mystery second account later.

const emailSchema = z.string().trim().toLowerCase().email("That doesn't look like an email address.");

export type EmailLookup =
  | { kind: "existing"; provider: "apple" | "google" | null }
  | { kind: "new" }
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
  if (!user) return { kind: "new" };
  // Said up front, so somebody who joined with a button doesn't sit there
  // guessing at a password they never had.
  return {
    kind: "existing",
    provider: user.appleSub ? "apple" : user.googleSub ? "google" : null,
  };
}

export type AuthState = { error: string | null };

const signupSchema = z.object({
  name: z.string().trim().min(2, "What should people call you? Two letters at least.").max(80),
  email: emailSchema,
  password: z.string().min(8, "Your password needs at least 8 characters."),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

/** Step two, either way round. Errors come back as state rather than a
 * redirect, so a wrong password is a line of red under the box and not a
 * reload that empties the form. */
export async function emailAuthAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const prisma = await getPrisma();

  if (formData.get("mode") === "signup") {
    const parsed = signupSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { name, email, password } = parsed.data;

    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      return { error: "There's already an account with that email. Go back and sign in instead." };
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        // Nobody is made to confirm an address we have no way of writing to,
        // so with email switched off the account is confirmed from the start.
        emailVerifiedAt: emailVerificationEnabled() ? null : new Date(),
      },
    });
    await ensureMembership(prisma, user.id);
    await createSession(user.id);

    if (emailVerificationEnabled()) {
      const sent = await sendVerificationCode(prisma, user);
      // A send that fails still lands them on /verify-email; the page has a
      // resend button, which beats dead-ending them here with an account
      // that already exists.
      redirect(sent.ok ? "/verify-email" : `/verify-email?error=${encodeURIComponent(sent.error)}`);
    }
    redirect("/");
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "That password isn't right. Try again." };
  }
  if (user.accountStatus === "SUSPENDED") {
    return { error: "This account has been suspended." };
  }

  await createSession(user.id);
  redirect(nextStepFor(user));
}

/** Where a signed-in member should land: confirm the email if one is
 * still owed, then the map, unless the membership fee is switched on and
 * theirs has lapsed. */
function nextStepFor(user: { role: string; paidUntil: Date | null; emailVerifiedAt: Date | null }) {
  if (needsEmailCheck(user)) return "/verify-email";
  return isPaidUp(user) ? "/" : "/subscribe";
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}
