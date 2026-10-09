import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { getPrisma } from "@/lib/db";
import type { User } from "@prisma/client";

// Kept through the renames: it's an invisible implementation detail, and
// changing it would sign every member out for no visible gain.
const SESSION_COOKIE = "pacemates_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET is not set. Add it to your .env file (see .env.example)."
    );
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

async function getSession(): Promise<{ userId: string; issuedAt: number } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.userId !== "string") return null;
    return { userId: payload.userId, issuedAt: (payload.iat ?? 0) * 1000 };
  } catch {
    return null;
  }
}

export async function getSessionUserId(): Promise<string | null> {
  return (await getSession())?.userId ?? null;
}

/** Now, to the whole second, for passwordChangedAt. A session's issue time
 * is only kept to the second, so this is what lets the session started
 * straight after a change count as newer than it. */
export function passwordChangeStamp(): Date {
  return new Date(Math.floor(Date.now() / 1000) * 1000);
}

/** Whether this account has a password its owner chose, as opposed to the
 * unknowable one an Apple or Google signup is given. */
export function hasOwnPassword(
  user: Pick<User, "appleSub" | "googleSub" | "passwordChangedAt">
): boolean {
  return !(user.appleSub || user.googleSub) || user.passwordChangedAt != null;
}

/** The signed-in member, minus their photo. The photo is the one big thing
 * on the row, and this runs several times on every page; whether there is
 * one is profilePhotoType, and the picture itself comes from
 * /api/photos/profile/[userId] only when something actually shows it. */
export type CurrentUser = Omit<User, "profilePhoto">;

/** Returns the logged-in user or null. Does not redirect. Remembered for
 * the rest of the request (cache), since the layout, the nav and the page
 * all ask. */
export const getCurrentUser = cache(async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session) return null;
  const prisma = await getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    omit: { profilePhoto: true },
  });
  // Suspended or banned: as good as signed out, everywhere, at once.
  if (!user || user.accountStatus !== "ACTIVE") return null;
  // Signed in before the password last changed: that's exactly the
  // session a password change is meant to end.
  if (user.passwordChangedAt && session.issuedAt < user.passwordChangedAt.getTime()) return null;
  return user;
});

/** Requires any logged-in, non-suspended user. Redirects to /login otherwise. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Where to go after signing in: a path on this site, or home. Anything
 * else (another site, "//evil.com", a backslash trick) is ignored, so a
 * link can't use our sign-in page to send people somewhere else. */
export function safeNext(raw: unknown): string {
  const next = typeof raw === "string" ? raw : "";
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\") || next.startsWith("/login")) {
    return "/";
  }
  return next;
}

/** Whether the membership fee is being charged at all.
 *
 * Off by default, and meant to stay off for now: the app is free for
 * everyone while it grows. The XRP flow underneath (/subscribe, the admin
 * ledger scan, the payment log) is untouched and starts gating again the
 * moment this is set to "true" in the environment.
 *
 * Note that setting it also means taking money, which the Vercel Hobby
 * plan doesn't allow: that switch and a paid Vercel plan go together. */
function membershipRequired(): boolean {
  return process.env.MEMBERSHIP_REQUIRED === "true";
}

export function isPaidUp(user: Pick<User, "role" | "paidUntil">): boolean {
  if (!membershipRequired()) return true;
  return user.role === "ADMIN" || (user.paidUntil != null && user.paidUntil > new Date());
}

/** The bar for joining meetups and giving thumbs up: a signed-in,
 * non-suspended account, plus a current membership if the fee is switched
 * on. Posting meetups asks for more than this, see src/lib/trust.ts. */
export async function requireMember(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!isPaidUp(user)) {
    redirect("/subscribe");
  }
  return user;
}

/** Requires a logged-in admin. Redirects home otherwise. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    redirect("/");
  }
  return user;
}

/** Strips fields that should never be sent to the client. */
export function publicUser(user: User) {
  const { passwordHash, ...rest } = user;
  return rest;
}
