"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { errorQuery } from "@/lib/flash";
import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { NOT_NICE, NO_ADS, looksLikeAdvert, looksOffensive } from "@/lib/bots";
import {
  createSession,
  destroySession,
  hashPassword,
  hasOwnPassword,
  passwordChangeStamp,
  requireUser,
  verifyPassword,
} from "@/lib/auth";

const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Type your first name.")
    .max(80)
    .refine((v) => !looksLikeAdvert(v), NO_ADS)
    .refine((v) => !looksOffensive(v), NOT_NICE),
});

export async function updateProfileAction(formData: FormData) {
  const user = await requireUser();

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    redirect(`/profile?${errorQuery(parsed.error.issues[0]?.message ?? "Check your details.")}`);
  }

  const prisma = await getPrisma();
  await prisma.user.update({ where: { id: user.id }, data: { name: parsed.data.name } });

  redirect("/profile?saved=1");
}

export type PasswordState = { error: string | null; done: boolean };

/** Change your password from the profile. Ends every other session: the
 * phone or browser you're on stays signed in, nothing else does. */
export async function changePasswordAction(
  _prev: PasswordState,
  formData: FormData
): Promise<PasswordState> {
  const user = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  // Somebody who only ever came in with Apple or Google has never had a
  // password to type, so they set one without being asked for the old.
  if (hasOwnPassword(user)) {
    if (!(await verifyPassword(current, user.passwordHash))) {
      return { error: "Current password is wrong.", done: false };
    }
  }
  if (next.length < 8) return { error: "New password: 8 or more characters.", done: false };
  if (next !== confirm) return { error: "The new passwords don't match.", done: false };

  const prisma = await getPrisma();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(next),
      passwordChangedAt: passwordChangeStamp(),
      failedLogins: 0,
      lockedUntil: null,
    },
  });
  // A fresh session for this device, issued after the change, so it's the
  // one that survives.
  await createSession(user.id);
  return { error: null, done: true };
}

/** Unblock someone, from the list on Me. */
export async function unblockUserAction(formData: FormData) {
  const user = await requireUser();
  const prisma = await getPrisma();
  await prisma.block.deleteMany({ where: { blockerId: user.id, blockedId: String(formData.get("blockedId")) } });
  // Redrawn, not just scrolled to: going from /profile to /profile#blocked
  // is only a jump down the page, which would leave them listed.
  revalidatePath("/profile");
  revalidatePath("/");
  redirect("/profile#blocked");
}

/** Deletes your account and everything that hangs off it: meetups you
 * were hosting, your places on others, your thumbs up. For good. */
export async function deleteAccountAction() {
  const user = await requireUser();
  const prisma = await getPrisma();
  if (user.role === "ADMIN") {
    const admins = await prisma.user.count({ where: { role: "ADMIN", accountStatus: "ACTIVE" } });
    if (admins <= 1) {
      redirect(
        `/profile?${errorQuery("You're the only admin. Make someone else admin first.")}`
      );
    }
  }
  await prisma.user.delete({ where: { id: user.id } });
  await destroySession();
  redirect("/");
}
