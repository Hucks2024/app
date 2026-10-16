// The languages Packmates speaks. Everything is written in English first
// (messages/en.ts) and every other language follows its shape exactly, so
// a line missing in one is a build error, not a blank on someone's screen.
//
// No language in the address: the choice is a cookie, set from the picker
// (on the front page, Info and Me), and until someone picks, the phone's
// own language decides.

export const LOCALES = ["en", "zh", "hi", "es", "fr"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** The ones switched on: English only while the app finds its feet in
 * one city. The others stay written and kept in step (a missing line is
 * still a build error), ready to add here once a native speaker has
 * checked them. With just the one, there's no picker either. */
export const LIVE_LOCALES: readonly Locale[] = ["en"];
export const CAN_PICK_LANGUAGE = LIVE_LOCALES.length > 1;

/** Each in its own words, for the picker. */
export const LANGUAGE_NAMES: Record<Locale, string> = {
  en: "English",
  zh: "中文",
  hi: "हिन्दी",
  es: "Español",
  fr: "Français",
};

export const LANG_COOKIE = "lang";

/** One of ours that's switched on. */
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LIVE_LOCALES as readonly string[]).includes(value);
}

/** Ours that best fits a browser's Accept-Language header
 * ("zh-CN,zh;q=0.9,en;q=0.8"), English if none does. */
export function pickLocale(header: string | null | undefined): Locale {
  const wanted = (header ?? "")
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(";");
      const q = Number(params.find((p) => p.trim().startsWith("q="))?.split("=")[1] ?? 1);
      return { lang: tag.trim().toLowerCase().split(/[-_]/)[0], q: Number.isFinite(q) ? q : 0, i };
    })
    .filter((w) => w.lang && w.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  const found = wanted.find((w) => isLocale(w.lang));
  return found ? (found.lang as Locale) : DEFAULT_LOCALE;
}
