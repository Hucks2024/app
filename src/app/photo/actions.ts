"use server";

import { redirect } from "next/navigation";
import { requireUser, safeNext } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { ImageValidationError, readImageFile } from "@/lib/images";
import { errorQuery } from "@/lib/flash";
import { joinMeetup } from "@/lib/join";

/** Saves the photo, then finishes whatever it was needed for: the join
 * they'd tapped "I'm in" for, or the page they were heading to. */
export async function savePhotoAction(formData: FormData) {
  const user = await requireUser();
  const join = String(formData.get("join") ?? "");
  const next = safeNext(formData.get("next"));
  const back = (message: string) => {
    const params = new URLSearchParams();
    if (join) params.set("join", join);
    else if (next !== "/") params.set("next", next);
    const rest = params.toString();
    redirect(`/photo?${errorQuery(message)}${rest ? `&${rest}` : ""}`);
  };

  let photo: Awaited<ReturnType<typeof readImageFile>> = null;
  try {
    photo = await readImageFile(formData.get("photo") as File | null);
  } catch (err) {
    back(err instanceof ImageValidationError ? err.message : "Photo didn't upload. Try again.");
  }
  if (!photo) back("Pick a photo first.");

  const prisma = await getPrisma();
  await prisma.user.update({
    where: { id: user.id },
    data: { profilePhoto: photo!.bytes, profilePhotoType: photo!.type },
  });

  if (join) redirect(await joinMeetup(prisma, user.id, join));
  redirect(next === "/" ? "/profile?saved=1" : next);
}
