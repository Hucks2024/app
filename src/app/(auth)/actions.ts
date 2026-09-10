"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/db";
import { createSession, destroySession, hashPassword, isPaidUp, verifyPassword } from "@/lib/auth";

const signupSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  city: z.string().trim().max(80).optional(),
});

export async function signupAction(formData: FormData) {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    city: formData.get("city") || undefined,
  });

  if (!parsed.success) {
    redirect(`/signup?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);
  }

  const { name, email, password, city } = parsed.data;

  const prisma = await getPrisma();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    redirect(`/signup?error=${encodeURIComponent("An account with that email already exists.")}`);
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, city },
  });

  await createSession(user.id);
  redirect("/subscribe");
}

/** Where a logged-in user should land: pay, then verify, then the app. */
function nextStepFor(user: {
  role: string;
  paidUntil: Date | null;
  verificationStatus: string;
}) {
  if (!isPaidUp(user)) return "/subscribe";
  if (user.verificationStatus !== "APPROVED") return "/verify";
  return "/activities";
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
