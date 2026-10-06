"use server";

import { redirect } from "next/navigation";
import { requireUser, safeNext } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { checkVerificationCode, sendVerificationCode } from "@/lib/email-verification";

// Where they were heading before the code step (a meetup a friend shared,
// say), carried through so confirming lands them there, not on the map.
function withNext(path: string, next: string): string {
  if (next === "/") return path;
  return `${path}${path.includes("?") ? "&" : "?"}next=${encodeURIComponent(next)}`;
}

export async function confirmEmailAction(formData: FormData) {
  const user = await requireUser();
  const prisma = await getPrisma();
  const next = safeNext(formData.get("next"));

  // People copy codes with spaces in ("123 456") or type them that way.
  const code = String(formData.get("code") ?? "").replace(/\s+/g, "");
  const result = await checkVerificationCode(prisma, user.id, code);
  if (!result.ok) {
    redirect(withNext(`/verify-email?error=${encodeURIComponent(result.error)}`, next));
  }

  redirect(next);
}

export async function resendCodeAction(formData: FormData) {
  const user = await requireUser();
  const prisma = await getPrisma();
  const next = safeNext(formData.get("next"));

  const sent = await sendVerificationCode(prisma, user);
  if (!sent.ok) {
    redirect(withNext(`/verify-email?error=${encodeURIComponent(sent.error)}`, next));
  }

  redirect(withNext("/verify-email?sent=1", next));
}
