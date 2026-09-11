"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/db";
import { createSession, destroySession, hashPassword, isPaidUp, verifyPassword } from "@/lib/auth";
import { checkInviteCode, spendInvite } from "@/lib/invite";

const signupSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  city: z.string().trim().max(80).optional(),
  inviteCode: z.string().trim().min(1, "Enter the invite code from the member who invited you."),
});

export async function signupAction(formData: FormData) {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    city: formData.get("city") || undefined,
    inviteCode: formData.get("inviteCode"),
  });

  if (!parsed.success) {
    redirect(`/signup?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);
  }

  const { name, email, password, city, inviteCode } = parsed.data;

  const prisma = await getPrisma();

  // Invite-only: no valid code, no account. Checked before anything is
  // written so a bad code can't leave a half-made user behind.
  const invite = await checkInviteCode(prisma, inviteCode);
  if (!invite.ok) {
    redirect(`/signup?error=${encodeURIComponent(invite.reason)}`);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    redirect(`/signup?error=${encodeURIComponent("An account with that email already exists.")}`);
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, city, invitedById: invite.inviter.id },
  });
  await spendInvite(prisma, invite.inviter);

  await createSession(user.id);
  redirect(nextStepFor(user));
}

/** Where a logged-in user should land. Straight into the app, unless the
 * membership fee is switched on and theirs has lapsed. */
function nextStepFor(user: { role: string; paidUntil: Date | null }) {
  return isPaidUp(user) ? "/activities" : "/subscribe";
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect(`/login?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);
  }

  const { email, password } = parsed.data;
  const prisma = await getPrisma();
  const user = await prisma.user.findUnique({ where: { email } });
  const genericError = encodeURIComponent("Incorrect email or password.");
  if (!user) {
    redirect(`/login?error=${genericError}`);
  }
  if (user.accountStatus === "SUSPENDED") {
    redirect(`/login?error=${encodeURIComponent("This account has been suspended.")}`);
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    redirect(`/login?error=${genericError}`);
  }

  await createSession(user.id);
  redirect(nextStepFor(user));
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}
