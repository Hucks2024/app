"use client";

import { useSyncExternalStore } from "react";
import { useLocale, useT } from "@/i18n/client";
import type { Locale } from "@/i18n/config";

// Meetup times in the time zone, and the clock, of whoever is looking.
//
// The server has no idea where the reader is, so it renders London time
// on a 24-hour clock, and the browser switches to its own zone and its own
// habits the moment it's running: 7:00 AM in the US, 07:00 almost
// everywhere else. Reading times in an unfamiliar format means converting
// every one in your head. useSyncExternalStore is what makes the switch
// without a hydration mismatch: the first render in the browser matches
// the server's, then the real one follows.
//
// Days and months are in the app's language ("Saturday 17 October",
// "10月17日星期六"); the clock follows the device.

export type TimePrefs = { zone?: string; locale: string; hour12: boolean };

/** How each of our languages writes a date. English goes by the device:
 * US or British. */
const DATE_TAG: Record<Locale, string> = { en: "en-GB", zh: "zh-CN", hi: "hi-IN", es: "es-ES", fr: "fr-FR" };

export function serverPrefs(lang: Locale = "en"): TimePrefs {
  return { zone: "Europe/London", locale: DATE_TAG[lang], hour12: false };
}

const clientCache = new Map<Locale, TimePrefs>();

/** This device's own: its zone, whether its locale reads a 12-hour clock,
 * and, in English, US or British wording. */
export function clientPrefs(lang: Locale = "en"): TimePrefs {
  const cached = clientCache.get(lang);
  if (cached) return cached;
  if (typeof navigator === "undefined") return serverPrefs(lang);
  const device = deviceLanguage();
  let hour12 = false;
  try {
    hour12 = new Intl.DateTimeFormat(device, { hour: "numeric" }).resolvedOptions().hour12 ?? false;
  } catch {
    // A 24-hour clock is the safe guess.
  }
  const locale = lang === "en" ? (/^en-US/i.test(device) ? "en-US" : "en-GB") : DATE_TAG[lang];
  const prefs = { zone: undefined, locale, hour12 };
  clientCache.set(lang, prefs);
  return prefs;
}

/** The device's language as a tag Intl accepts. Some systems report
 * things like "en-US@posix" or "en_US.UTF-8", which Intl throws on, and a
 * date must never be what takes a page down. */
export function deviceLanguage(): string {
  const raw = (typeof navigator !== "undefined" && navigator.language) || "en-GB";
  try {
    return Intl.getCanonicalLocales(raw.split(/[@.]/)[0].replace(/_/g, "-"))[0] ?? "en-GB";
  } catch {
    return "en-GB";
  }
}

const english = (prefs: TimePrefs) => prefs.locale.startsWith("en");

// In English, built from the pieces Intl gives back rather than its
// finished string, because the punctuation in that string changes between
// ICU versions ("Fri 9 Oct" on the server, "Fri, 9 Oct" in Chrome), and
// the first render in the browser has to match the server's letter for
// letter. The other languages take Intl's own wording, which is the only
// way to get their word order right.
function parts(d: Date, prefs: TimePrefs, options: Intl.DateTimeFormatOptions) {
  const out: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const part of new Intl.DateTimeFormat(prefs.locale, { timeZone: prefs.zone, ...options }).formatToParts(d)) {
    out[part.type] = part.value;
  }
  return out;
}

/** "07:00" or "7:00 AM", as this reader would write it. */
export function clockTime(d: Date, prefs: TimePrefs = clientPrefs()): string {
  if (!english(prefs)) {
    return new Intl.DateTimeFormat(prefs.locale, {
      timeZone: prefs.zone,
      hour: "numeric",
      minute: "2-digit",
      hour12: prefs.hour12,
    }).format(d);
  }
  const p = parts(d, prefs, {
    hour: prefs.hour12 ? "numeric" : "2-digit",
    minute: "2-digit",
    hour12: prefs.hour12,
  });
  // Some engines write midnight on a 24-hour clock as "24".
  const hour = !prefs.hour12 && p.hour === "24" ? "00" : p.hour;
  return prefs.hour12 ? `${hour}:${p.minute} ${p.dayPeriod}` : `${hour}:${p.minute}`;
}

function dayKey(d: Date, zone: string | undefined) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

type Style = "long" | "short";
export type DayWords = { today: string; tomorrow: string };

export function formatWhen(
  iso: string,
  style: Style,
  prefs: TimePrefs = clientPrefs(),
  words: DayWords = { today: "Today", tomorrow: "Tomorrow" }
): string {
  const d = new Date(iso);
  const time = clockTime(d, prefs);
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (dayKey(d, prefs.zone) === dayKey(now, prefs.zone)) return `${words.today} · ${time}`;
  if (dayKey(d, prefs.zone) === dayKey(tomorrow, prefs.zone)) return `${words.tomorrow} · ${time}`;

  const sameYear =
    new Intl.DateTimeFormat("en", { timeZone: prefs.zone, year: "numeric" }).format(d) ===
    new Intl.DateTimeFormat("en", { timeZone: prefs.zone, year: "numeric" }).format(now);
  const withYear = !sameYear && style !== "short";
  const options: Intl.DateTimeFormatOptions = {
    weekday: style === "short" ? "short" : "long",
    day: "numeric",
    month: style === "short" ? "short" : "long",
    ...(withYear || english(prefs) ? { year: "numeric" } : {}),
  };
  if (!english(prefs)) {
    return `${new Intl.DateTimeFormat(prefs.locale, { timeZone: prefs.zone, ...options }).format(d)} · ${time}`;
  }
  const p = parts(d, prefs, options);
  // "Friday 9 October" in Britain and most places, "Friday, October 9" in the US.
  const day =
    prefs.locale === "en-US"
      ? `${p.weekday}, ${p.month} ${p.day}${withYear ? `, ${p.year}` : ""}`
      : `${p.weekday} ${p.day} ${p.month}${withYear ? ` ${p.year}` : ""}`;
  return `${day} · ${time}`;
}

const subscribe = () => () => {};

/** This device's habits in the app's language: the server's guess on the
 * first render, the device's own after. */
export function useTimePrefs(): TimePrefs {
  const lang = useLocale();
  return useSyncExternalStore(subscribe, () => clientPrefs(lang), () => serverPrefs(lang));
}

/** formatWhen for this reader, in the app's language. */
export function useFormatWhen(): (iso: string, style: Style) => string {
  const prefs = useTimePrefs();
  const lang = useLocale();
  const t = useT();
  return (iso, style) => {
    try {
      return formatWhen(iso, style, prefs, t.time);
    } catch {
      // Some odd device setting: the way the server does it instead.
      return formatWhen(iso, style, serverPrefs(lang), t.time);
    }
  };
}

export default function LocalTime({ iso, style = "long" }: { iso: string; style?: Style }) {
  const when = useFormatWhen();
  // suppressHydrationWarning only as a backstop: if some browser still
  // words a date differently, that's not worth re-rendering the page over.
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {when(iso, style)}
    </time>
  );
}
