"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { readImageFile, ImageValidationError } from "@/lib/images";

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  city: z.string().trim().max(80).optional(),
  pace: z.string().trim().max(40).optional(),
  bio: z.string().trim().max(500).optional(),
});

export async function updateProfileAction(formData: FormData) {
  const user = await requireUser();

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    city: formData.get("city") || undefined,
    pace: formData.get("pace") || undefined,
    bio: formData.get("bio") || undefined,
  });

  if (!parsed.success) {
    redirect(`/profile?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);
  }

  let photo: { bytes: Uint8Array<ArrayBuffer>; type: string } | null = null;
  try {
    photo = await readImageFile(formData.get("profilePhoto") as File | null);
  } catch (err) {
    const message = err instanceof ImageValidationError ? err.message : "Upload failed.";
    redirect(`/profile?error=${encodeURIComponent(message)}`);
  }

  const prisma = await getPrisma();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      ...parsed.data,
      ...(photo
        ? { profilePhoto: photo.bytes, profilePhotoType: photo.type }
        : {}),
    },
  });

  redirect("/profile?saved=1");
}
