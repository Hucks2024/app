"use server";

import { randomInt } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/db";
import { hashPassword, passwordChangeStamp, requireAdmin } from "@/lib/auth";
import { processXrpPayments } from "@/lib/xrp";

export async function approveVerificationAction(formData: FormData) {
  await requireAdmin();
  const requestId = String(formData.get("requestId"));

  const prisma = await getPrisma();
  const request = await prisma.verificationRequest.findUnique({ where: { id: requestId } });
  if (!request) return;

  await prisma.$transaction([
    prisma.verificationRequest.update({
      where: { id: requestId },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewerNote: null,
        // Privacy: we only needed the ID photo to make this decision.
        idPhoto: null,
        idPhotoType: null,
      },
    }),
    prisma.user.update({
      where: { id: request.userId },
      data: {
        verificationStatus: "APPROVED",
        profilePhoto: request.selfiePhoto,
        profilePhotoType: request.selfiePhotoType,
      },
    }),
  ]);

  revalidatePath("/admin");
}

export async function rejectVerificationAction(formData: FormData) {
  await requireAdmin();
  const requestId = String(formData.get("requestId"));
  const note = (formData.get("note") as string)?.trim() || null;

  const prisma = await getPrisma();
  const request = await prisma.verificationRequest.findUnique({ where: { id: requestId } });
  if (!request) return;

  await prisma.$transaction([
    prisma.verificationRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        reviewerNote: note,
        idPhoto: null,
        idPhotoType: null,
      },
    }),
    prisma.user.update({
      where: { id: request.userId },
      data: { verificationStatus: "REJECTED" },
    }),
  ]);

  revalidatePath("/admin");
}

export async function resolveReportAction(formData: FormData) {
  await requireAdmin();
  const reportId = String(formData.get("reportId"));
  const prisma = await getPrisma();
  await prisma.report.update({ where: { id: reportId }, data: { status: "RESOLVED" } });
  revalidatePath("/admin");
}

export async function banUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId"));
  if (userId === admin.id) return;
  const prisma = await getPrisma();
  await prisma.user.update({ where: { id: userId }, data: { accountStatus: "SUSPENDED" } });
  revalidatePath("/admin");
}

export async function unbanUserAction(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId"));
  const prisma = await getPrisma();
  await prisma.user.update({ where: { id: userId }, data: { accountStatus: "ACTIVE" } });
  revalidatePath("/admin");
}

/** Checks the XRP Ledger for new payments and credits them. The whole
 * membership system's crediting step, run whenever an admin presses
 * "Scan now" on /admin, nothing else triggers it. */
export async function scanXrpPaymentsAction() {
  await requireAdmin();
  const walletAddress = process.env.XRP_WALLET_ADDRESS;
  if (!walletAddress) {
    redirect("/admin?xrpScan=" + encodeURIComponent("not configured"));
  }

  const prisma = await getPrisma();
  const result = await processXrpPayments(prisma, walletAddress);

  const summary = result.error
    ? `error: ${result.error}`
    : `credited ${result.credited}, ${result.skippedNoTag} with no tag, ${result.skippedUnmatchedTag.length} with an unrecognized tag${result.skippedUnmatchedTag.length ? ` (${result.skippedUnmatchedTag.join(", ")})` : ""}`;

  redirect("/admin?xrpScan=" + encodeURIComponent(summary));
}

/** Gives somebody the ✓, and with it posting, without a first meetup.
 *
 * Normally earned by going to one (see src/lib/trust.ts). This is for
 * when it can't be: someone starting things off in a new city, with
 * nobody there yet to host the first one. */
export async function setVerifiedAction(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId"));
  const prisma = await getPrisma();
  await prisma.user.updateMany({
    where: { id: userId, memberVerifiedAt: null },
    data: { memberVerifiedAt: new Date() },
  });
  revalidatePath("/admin");
}

/** Makes a member an admin, or takes it away, from the members table.
 *
 * Admins can do everything here, can't be red-flagged out and can always
 * post, which is why it's a deliberate two-tap action on the page. You
 * can't change your own role: that's how an app ends up with no admins. */
export async function setAdminAction(formData: FormData) {
  const me = await requireAdmin();
  const userId = String(formData.get("userId"));
  const makeAdmin = formData.get("admin") === "1";
  if (userId === me.id) return;

  const prisma = await getPrisma();
  await prisma.user.updateMany({
    where: { id: userId, ...(makeAdmin ? { accountStatus: "ACTIVE" } : {}) },
    data: makeAdmin
      ? { role: "ADMIN", memberVerifiedAt: new Date() }
      : { role: "USER" },
  });
  revalidatePath("/admin");
}

export type ResetState = { password: string | null; error: string | null };

// No 0/O/1/l/I: read off a screen and typed into a phone by somebody else.
const TEMP_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** A temporary password for a member who's forgotten theirs, shown once
 * to the admin to pass on. Signs the member out everywhere and clears any
 * lock; they sign in with it and change it on their profile. Only needed
 * while email isn't set up: with it, members reset their own. */
export async function resetPasswordAction(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const me = await requireAdmin();
  const userId = String(formData.get("userId"));
  if (userId === me.id) {
    return { password: null, error: "Change your own on your profile." };
  }
  const temp = Array.from({ length: 10 }, () => TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)])
    .join("")
    .replace(/(.{5})/, "$1-");
  const prisma = await getPrisma();
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(temp),
      passwordChangedAt: passwordChangeStamp(),
      failedLogins: 0,
      lockedUntil: null,
    },
  });
  return { password: temp, error: null };
}
