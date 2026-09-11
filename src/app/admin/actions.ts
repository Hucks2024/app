"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { processXrpPayments } from "@/lib/xrp";
import { DEFAULT_INVITES } from "@/lib/invite";

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

/** Tops a member's invite allowance back up. The cap exists so one code
 * leaking can't open the doors; this is the release valve for members who
 * are actually bringing good people in. */
export async function grantInvitesAction(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId"));
  const prisma = await getPrisma();
  await prisma.user.update({
    where: { id: userId },
    data: { invitesLeft: { increment: DEFAULT_INVITES } },
  });
  revalidatePath("/admin");
}
