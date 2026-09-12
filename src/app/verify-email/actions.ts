"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { checkVerificationCode, sendVerificationCode } from "@/lib/email-verification";

export async function confirmEmailAction(formData: FormData) {
  const user = await requireUser();
  const prisma = await getPrisma();

  const result = await checkVerificationCode(prisma, user.id, String(formData.get("code") ?? ""));
  if (!result.ok) {
    redirect(`/verify-email?error=${encodeURIComponent(result.error)}`);
  }

  redirect("/activities");
}

export async function resendCodeAction() {
  const user = await requireUser();
  const prisma = await getPrisma();

  const sent = await sendVerificationCode(prisma, user);
  if (!sent.ok) {
    redirect(`/verify-email?error=${encodeURIComponent(sent.error)}`);
  }

  redirect("/verify-email?sent=1");
}
