import { createHmac } from "crypto";
import type { PrismaClient } from "@prisma/client";
import { isGender, type Gender } from "@/lib/gender";

// Male, female or T-Rex is for good (see src/lib/gender.ts), and deleting
// an account and joining again with the same email isn't a way round it.
// When somebody deletes their account, a fingerprint of their email is
// kept with what they'd picked, and nothing else. The same email joining
// again gets the same back.

/** The same for every way of writing one inbox: any case, a "+anything"
 * tag, and for Gmail the dots. Keyed with the app's secret, so the email
 * can't be worked back out of it. */
export function emailFingerprint(email: string): string {
  const [local = "", domain = ""] = email.trim().toLowerCase().split("@");
  let name = local.split("+")[0];
  const gmail = domain === "gmail.com" || domain === "googlemail.com";
  if (gmail) name = name.replace(/\./g, "");
  return createHmac("sha256", process.env.SESSION_SECRET ?? "")
    .update(`deleted:${name}@${gmail ? "gmail.com" : domain}`)
    .digest("base64url");
}

/** Noted as an account is deleted. */
export async function rememberGender(prisma: PrismaClient, email: string, gender: string | null) {
  if (!isGender(gender)) return;
  const emailHash = emailFingerprint(email);
  await prisma.deletedEmail.upsert({
    where: { emailHash },
    create: { emailHash, gender },
    update: { gender, deletedAt: new Date() },
  });
}

/** What this email had picked before, if it had an account once. */
export async function genderFromBefore(prisma: PrismaClient, email: string): Promise<Gender | null> {
  const row = await prisma.deletedEmail.findUnique({ where: { emailHash: emailFingerprint(email) } });
  return row && isGender(row.gender) ? row.gender : null;
}
