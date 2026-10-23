"use server";

import { z } from "zod";
import type { PrismaClient, User } from "@prisma/client";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
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
import { checkCode, sendCode } from "@/lib/email-code";
import { clearWrongPasswords, minutesLocked, recordWrongPassword } from "@/lib/lockout";
import {
  NOT_NICE,
  NO_ADS,
  isThrowawayEmail,
  issueSignupTicket,
  looksLikeAdvert,
  looksOffensive,
  signupTicketOk,
} from "@/lib/bots";
import { SITE } from "@/lib/site";
import { getLocale, getT } from "@/i18n/server";
import { errorText, fill, plural } from "@/i18n/format";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { isGender } from "@/lib/gender";
import { passedPersonCheck } from "@/lib/turnstile";

// One way in for email, in two steps: the address first, then either the
// password (we know you) or a name and a new password (we don't). Nobody
// has to decide between "log in" and "sign up" before they've typed
// anything, and a mistyped address shows up as "create your account"
// instead of as a mystery second account later.

// Messages are names of lines in t.errors, shown in the member's language.
const emailSchema = z.string().trim().toLowerCase().email("checkEmail");

export type EmailLookup =
  | { kind: "existing"; provider: "apple" | "google" | null }
  | { kind: "new"; ticket: string }
  | { kind: "invalid"; error: string };

/** Step one: is there an account at this address? */
export async function lookupEmailAction(raw: string): Promise<EmailLookup> {
  const t = await getT();
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) return { kind: "invalid", error: errorText(t, parsed.error.issues[0].message) };

  const prisma = await getPrisma();
  const user = await prisma.user.findUnique({
    where: { email: parsed.data },
    select: { appleSub: true, googleSub: true },
  });
  if (!user) {
    if (isThrowawayEmail(parsed.data)) return { kind: "invalid", error: t.errors.throwaway };
    return { kind: "new", ticket: issueSignupTicket(parsed.data) };
  }
  // Said up front, so somebody who joined with a button doesn't sit there
  // guessing at a password they never had.
  return {
    kind: "existing",
    provider: user.appleSub ? "apple" : user.googleSub ? "google" : null,
  };
}

// confirm: a code has gone to the address, and the screen moves on to
// typing it in.
export type AuthState = { error: string | null; confirm?: true };

const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "firstName")
    .max(80)
    .refine((v) => !looksLikeAdvert(v), NO_ADS)
    .refine((v) => !looksOffensive(v), NOT_NICE),
  email: emailSchema,
  password: z.string().min(8, "passwordLength"),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "typePassword"),
});

/** Step two, either way round. Errors come back as state rather than a
 * redirect, so a wrong password is a line of red under the box and not a
 * reload that empties the form. */
export async function emailAuthAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const [prisma, t, lang] = await Promise.all([getPrisma(), getT(), getLocale()]);

  if (formData.get("mode") === "signup") {
    // A field people never see, so only a bot filling in every box
    // fills it in. Turned away with nothing that says why.
    if (String(formData.get("website") ?? "").length > 0) {
      return { error: t.errors.notNow };
    }
    const parsed = signupSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (!parsed.success) return { error: errorText(t, parsed.error.issues[0].message) };
    // The tick box: old enough, and agreeing to the Terms (no tolerance
    // for abuse) and the privacy policy. Checked here as well as in the
    // browser, which a script could skip.
    if (formData.get("agree") !== "on") return { error: fill(t.errors.agree, { age: SITE.minimumAge }) };
    const gender = formData.get("gender");
    if (!isGender(gender)) return { error: t.errors.pickGender };
    const { name, email, password } = parsed.data;
    if (isThrowawayEmail(email)) return { error: t.errors.throwaway };
    // Proof the form was filled in by hand (see src/lib/bots.ts).
    if (!signupTicketOk(String(formData.get("ticket") ?? ""), email)) {
      return { error: t.errors.notNow };
    }

    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      return { error: t.errors.emailTakenSignIn };
    }
    // Cloudflare's "are you a person?" (src/lib/turnstile.ts). Last of the
    // checks, as each answer from it works once: a mistake above shouldn't
    // use it up.
    const ip = (await headers()).get("cf-connecting-ip");
    if (!(await passedPersonCheck(String(formData.get("cf-turnstile-response") ?? ""), ip))) {
      return { error: t.errors.personCheck };
    }

    // Proof the address is theirs: a code goes to it, and there's no way
    // in until it's typed. An account nobody confirms can't be used, and
    // whoever owns the address can take it back with "Forgot your
    // password?". Only a copy of the app with no email set up lets people
    // straight in.
    const confirm = canSendEmail();
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        gender,
        emailVerifiedAt: confirm ? null : new Date(),
      },
    });
    if (confirm) return sendJoinCode(prisma, user, t, lang);
    await ensureMemberNumber(prisma, user.id);
    await createSession(user.id);
    redirect(safeNext(formData.get("next")));
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: errorText(t, parsed.error.issues[0].message) };
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { error: t.errors.wrongPassword };

  const locked = minutesLocked(user);
  if (locked > 0) {
    return { error: plural(t.errors.tooManyWait, locked, lang) };
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    const left = await recordWrongPassword(prisma, user);
    if (left === 0) {
      return { error: plural(t.errors.tooManyWait, 15, lang) };
    }
    return {
      error: left <= 2 ? plural(t.errors.wrongPasswordLeft, left, lang) : t.errors.wrongPassword,
    };
  }
  if (user.failedLogins > 0) await clearWrongPasswords(prisma, user.id);
  if (user.accountStatus === "BANNED") {
    return { error: t.errors.banned };
  }
  if (user.accountStatus !== "ACTIVE") {
    return { error: t.errors.onHold };
  }
  // Joined but never typed the code: a new one, and the same screen.
  if (!user.emailVerifiedAt && canSendEmail()) return sendJoinCode(prisma, user, t, lang);

  await createSession(user.id);
  redirect(safeNext(formData.get("next")));
}

/** Emails the code that proves the address is theirs, and moves the
 * screen on to typing it in. If the email didn't go, the screen says so,
 * and "Send a new code" tries again. */
async function sendJoinCode(
  prisma: PrismaClient,
  user: { id: string; email: string; name: string },
  t: Messages,
  lang: Locale
): Promise<AuthState> {
  const sent = await sendCode(prisma, user, "join", t, lang);
  // A cooldown means a code went out a moment ago, and still works.
  if (sent.ok || sent.cooldown) return { error: null, confirm: true };
  console.error("Join code email failed:", sent.error);
  return { error: t.errors.emailDidntSend, confirm: true };
}

const confirmSchema = z.object({
  email: emailSchema,
  code: z.string().trim().min(1, "typeCode"),
  password: z.string().min(1, "typePassword"),
});

/** The code from the email: the address is theirs, and they're in.
 *
 * The password they chose comes too (the screen sends it along), so a code
 * can only finish an account for whoever made it. Otherwise somebody
 * could join with your address, and when you typed the code you'd be
 * confirming their account, password and all. */
export async function confirmEmailAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const [prisma, t, lang] = await Promise.all([getPrisma(), getT(), getLocale()]);
  const parsed = confirmSchema.safeParse({
    email: formData.get("email"),
    code: formData.get("code"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: errorText(t, parsed.error.issues[0].message), confirm: true };

  const user = await passwordChecked(prisma, parsed.data.email, parsed.data.password, t, lang);
  if ("error" in user) return { error: user.error, confirm: true };

  if (!user.emailVerifiedAt) {
    const checked = await checkCode(prisma, user.id, parsed.data.code, t, lang);
    if (!checked.ok) return { error: checked.error, confirm: true };
    await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    await ensureMemberNumber(prisma, user.id);
  }
  await createSession(user.id);
  redirect(safeNext(formData.get("next")));
}

/** "Send a new code", on the screen for typing it in. */
export async function resendJoinCodeAction(email: string, password: string): Promise<AuthState> {
  const [prisma, t, lang] = await Promise.all([getPrisma(), getT(), getLocale()]);
  const parsedEmail = emailSchema.safeParse(email);
  if (!parsedEmail.success) return { error: t.errors.checkEmail, confirm: true };
  const user = await passwordChecked(prisma, parsedEmail.data, password, t, lang);
  if ("error" in user) return { error: user.error, confirm: true };
  if (user.emailVerifiedAt) return { error: null, confirm: true };

  const sent = await sendCode(prisma, user, "join", t, lang);
  if (sent.ok) return { error: null, confirm: true };
  if (!sent.cooldown) console.error("Join code email failed:", sent.error);
  return { error: sent.cooldown ? sent.error : t.errors.emailDidntSend, confirm: true };
}

/** The account at this address, if this is its password and it isn't
 * locked, banned or on hold. Wrong passwords count towards the lock as
 * they do on the sign in screen. */
async function passwordChecked(
  prisma: PrismaClient,
  email: string,
  password: string,
  t: Messages,
  lang: Locale
): Promise<User | { error: string }> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { error: t.errors.codeExpired };
  const locked = minutesLocked(user);
  if (locked > 0) return { error: plural(t.errors.tooManyWait, locked, lang) };
  if (!(await verifyPassword(password, user.passwordHash))) {
    await recordWrongPassword(prisma, user);
    return { error: t.errors.wrongPassword };
  }
  if (user.accountStatus === "BANNED") return { error: t.errors.banned };
  if (user.accountStatus !== "ACTIVE") return { error: t.errors.onHold };
  return user;
}

/** Forgot your password, step one: email a code to the address. Only
 * possible when email is set up; the screen says so when it isn't. */
export async function startResetAction(raw: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const [t, lang] = await Promise.all([getT(), getLocale()]);
  if (!canSendEmail()) {
    return { ok: false, error: t.signIn.askAdmin };
  }
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: errorText(t, parsed.error.issues[0].message) };

  const prisma = await getPrisma();
  const user = await prisma.user.findUnique({ where: { email: parsed.data } });
  // Nothing goes to an address with no account, or to a banned one, but
  // the screen looks the same either way.
  if (!user || user.accountStatus !== "ACTIVE") return { ok: true };

  const sent = await sendCode(prisma, user, "reset", t, lang);
  if (!sent.ok) {
    // Into the server's logs; the Email steps on /admin say the same thing in
    // plain words.
    console.error("Password reset email failed:", sent.error);
    // The cooldown message is worth showing; a provider error isn't. And
    // "try again" only when trying again could help: a setup problem
    // fails every time, so that sends them to someone who can help.
    return {
      ok: false,
      error: sent.cooldown
        ? sent.error
        : isTemporaryEmailError(sent.error)
          ? t.errors.emailDidntSend
          : t.errors.emailNotWorking,
    };
  }
  return { ok: true };
}

const resetSchema = z.object({
  email: emailSchema,
  code: z.string().trim().min(1, "typeCode"),
  password: z.string().min(8, "passwordLength"),
});

/** Forgot your password, step two: the code from the email and a new
 * password, and you're signed in. Every other session ends. */
export async function finishResetAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const [t, lang] = await Promise.all([getT(), getLocale()]);
  const parsed = resetSchema.safeParse({
    email: formData.get("email"),
    code: formData.get("code"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: errorText(t, parsed.error.issues[0].message) };

  const prisma = await getPrisma();
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || user.accountStatus !== "ACTIVE") {
    return { error: t.errors.codeExpired };
  }
  const checked = await checkCode(prisma, user.id, parsed.data.code, t, lang);
  if (!checked.ok) return { error: checked.error };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.data.password),
      passwordChangedAt: passwordChangeStamp(),
      failedLogins: 0,
      lockedUntil: null,
      // The code went to the address, so it's theirs: this is also how
      // somebody takes back an address another person joined with.
      ...(user.emailVerifiedAt ? {} : { emailVerifiedAt: new Date() }),
    },
  });
  if (!user.emailVerifiedAt) await ensureMemberNumber(prisma, user.id);
  await createSession(user.id);
  // Home sorts out anything still owed (the code just confirmed the
  // address, so it won't be that).
  redirect(safeNext(formData.get("next")));
}


export async function logoutAction() {
  await destroySession();
  redirect("/");
}
