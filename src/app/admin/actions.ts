"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function approveVerificationAction(formData: FormData) {
  await requireAdmin();
  const requestId = String(formData.get("requestId"));

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
  await prisma.report.update({ where: { id: reportId }, data: { status: "RESOLVED" } });
  revalidatePath("/admin");
}

export async function banUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId"));
  if (userId === admin.id) return;
  await prisma.user.update({ where: { id: userId }, data: { accountStatus: "SUSPENDED" } });
  revalidatePath("/admin");
}

export async function unbanUserAction(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId"));
  await prisma.user.update({ where: { id: userId }, data: { accountStatus: "ACTIVE" } });
  revalidatePath("/admin");
}
