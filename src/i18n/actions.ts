"use server";

import { cookies } from "next/headers";
import { LANG_COOKIE, isLocale } from "@/i18n/config";

/** The language picker's choice, remembered for a year on this device. */
export async function setLanguageAction(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set(LANG_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
