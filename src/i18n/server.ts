import { cache } from "react";
import { cookies, headers } from "next/headers";
import { LANG_COOKIE, isLocale, pickLocale, type Locale } from "@/i18n/config";
import { MESSAGES, type Messages } from "@/i18n/messages";

/** This visitor's language: the one they picked, or else their phone's. */
export const getLocale = cache(async (): Promise<Locale> => {
  const picked = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLocale(picked)) return picked;
  return pickLocale((await headers()).get("accept-language"));
});

/** Everything the app says, in this visitor's language. */
export async function getT(): Promise<Messages> {
  return MESSAGES[await getLocale()];
}
