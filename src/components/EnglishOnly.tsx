import { getLocale, getT } from "@/i18n/server";

/** On the legal pages, for anyone reading the app in another language:
 * these are in English, and the English is what counts. */
export default async function EnglishOnly() {
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  if (locale === "en") return null;
  return (
    <p lang={locale} className="mt-4 rounded-xl bg-white/15 px-4 py-3 text-base text-white">
      {t.legal.englishOnly}
    </p>
  );
}
