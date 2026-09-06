import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { getPrisma } from "@/lib/db";
import type { User } from "@prisma/client";

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

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return (payload.userId as string) ?? null;
  } catch {
    return null;
  }
}

/** Returns the logged-in user (full record) or null. Does not redirect. */
export async function getCurrentUser(): Promise<User | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const prisma = await getPrisma();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.accountStatus === "SUSPENDED") return null;
  return user;
}

/** Requires any logged-in, non-suspended user. Redirects to /login otherwise. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Requires a logged-in user whose photo-ID verification has been approved. */
export async function requireVerifiedUser(): Promise<User> {
  const user = await requireUser();
  if (user.verificationStatus !== "APPROVED") {
    redirect("/verify");
  }
  return user;
}

/** Requires a logged-in admin. Redirects home otherwise. */
export async function requireAdmin(): Promise<User> {
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
