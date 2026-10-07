"use client";

import { useSyncExternalStore } from "react";

// Meetup times in the time zone, and the clock, of whoever is looking.
//
// The server has no idea where the reader is, so it renders London time
// on a 24-hour clock, and the browser switches to its own zone and its own
// habits the moment it's running: 7:00 AM in the US, 07:00 almost
// everywhere else. Reading times in an unfamiliar format means converting
// every one in your head. useSyncExternalStore is what makes the switch
// without a hydration mismatch: the first render in the browser matches
// the server's, then the real one follows.

export type TimePrefs = { zone?: string; locale: "en-GB" | "en-US"; hour12: boolean };

const SERVER_PREFS: TimePrefs = { zone: "Europe/London", locale: "en-GB", hour12: false };
let clientCache: TimePrefs | null = null;

/** This device's own: its zone, US or British English wording, and
 * whether its locale reads a 12-hour clock. */
export function clientPrefs(): TimePrefs {
  if (clientCache) return clientCache;
  if (typeof navigator === "undefined") return SERVER_PREFS;
  const lang = deviceLanguage();
  let hour12 = false;
  try {
    hour12 = new Intl.DateTimeFormat(lang, { hour: "numeric" }).resolvedOptions().hour12 ?? false;
  } catch {
    // A 24-hour clock is the safe guess.
  }
  clientCache = { zone: undefined, locale: /^en-US/i.test(lang) ? "en-US" : "en-GB", hour12 };
  return clientCache;
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

// Built from the pieces Intl gives back rather than its finished string,
// because the punctuation in that string changes between ICU versions
// ("Fri 9 Oct" on the server, "Fri, 9 Oct" in Chrome), and the first
// render in the browser has to match the server's letter for letter.
function parts(d: Date, prefs: TimePrefs, options: Intl.DateTimeFormatOptions) {
  const out: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const part of new Intl.DateTimeFormat(prefs.locale, { timeZone: prefs.zone, ...options }).formatToParts(d)) {
    out[part.type] = part.value;
  }
  return out;
}

/** "07:00" or "7:00 AM", as this reader would write it. */
export function clockTime(d: Date, prefs: TimePrefs = clientPrefs()): string {
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

export function formatWhen(iso: string, style: Style, prefs: TimePrefs = clientPrefs()): string {
  const d = new Date(iso);
  const time = clockTime(d, prefs);
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (dayKey(d, prefs.zone) === dayKey(now, prefs.zone)) return `Today · ${time}`;
  if (dayKey(d, prefs.zone) === dayKey(tomorrow, prefs.zone)) return `Tomorrow · ${time}`;

  const sameYear =
    new Intl.DateTimeFormat("en", { timeZone: prefs.zone, year: "numeric" }).format(d) ===
    new Intl.DateTimeFormat("en", { timeZone: prefs.zone, year: "numeric" }).format(now);
  const p = parts(d, prefs, {
    weekday: style === "short" ? "short" : "long",
    day: "numeric",
    month: style === "short" ? "short" : "long",
    year: "numeric",
  });
  const withYear = !sameYear && style !== "short";
  // "Friday 9 October" in Britain and most places, "Friday, October 9" in the US.
  const day =
    prefs.locale === "en-US"
      ? `${p.weekday}, ${p.month} ${p.day}${withYear ? `, ${p.year}` : ""}`
      : `${p.weekday} ${p.day} ${p.month}${withYear ? ` ${p.year}` : ""}`;
  return `${day} · ${time}`;
}

const subscribe = () => () => {};

export default function LocalTime({ iso, style = "long" }: { iso: string; style?: Style }) {
  const prefs = useSyncExternalStore(subscribe, clientPrefs, () => SERVER_PREFS);
  // suppressHydrationWarning only as a backstop: if some browser still
  // words a date differently, that's not worth re-rendering the page over.
  let text: string;
  try {
    text = formatWhen(iso, style, prefs);
  } catch {
    // Some odd device setting: show it the way the server does instead.
    text = formatWhen(iso, style, SERVER_PREFS);
  }
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text}
    </time>
  );
}
