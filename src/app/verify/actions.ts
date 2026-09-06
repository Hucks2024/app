"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { readImageFile, ImageValidationError } from "@/lib/images";

export async function submitVerificationAction(formData: FormData) {
  const user = await requireUser();

  if (user.verificationStatus === "APPROVED") {
    redirect("/activities");
  }

  let selfie, idPhoto;
  try {
    selfie = await readImageFile(formData.get("selfie") as File | null);
    idPhoto = await readImageFile(formData.get("idPhoto") as File | null);
  } catch (err) {
    const message = err instanceof ImageValidationError ? err.message : "Upload failed.";
    redirect(`/verify?error=${encodeURIComponent(message)}`);
  }

  if (!selfie || !idPhoto) {
    redirect(`/verify?error=${encodeURIComponent("Please upload both a selfie and a photo ID.")}`);
  }

  await prisma.verificationRequest.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      selfiePhoto: selfie.bytes,
      selfiePhotoType: selfie.type,
      idPhoto: idPhoto.bytes,
      idPhotoType: idPhoto.type,
      status: "PENDING",
    },
    update: {
      selfiePhoto: selfie.bytes,
      selfiePhotoType: selfie.type,
      idPhoto: idPhoto.bytes,
      idPhotoType: idPhoto.type,
      status: "PENDING",
      reviewerNote: null,
      reviewedAt: null,
      submittedAt: new Date(),
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { verificationStatus: "PENDING" },
  });

  redirect("/verify?submitted=1");
}
