"use client";

import { useSyncExternalStore } from "react";

// Meetup times in the time zone of whoever is looking.
//
// The server has no idea where the reader is, and used to print UTC, so
// the meetup page said 7:00 while the map said 8:00 all summer. This
// renders London time on the server (where most meetups are, so most
// people see no change at all) and switches to the device's own zone the
// moment it's running in the browser. useSyncExternalStore is what makes
// that switch without a hydration mismatch: the first client render uses
// the server's answer, then the real one follows.

const SERVER_ZONE = "Europe/London";
const subscribe = () => () => {};

type Style = "long" | "short";

function parts(d: Date, zone: string | undefined) {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d)) {
    out[p.type] = p.value;
  }
  return out;
}

function dayKey(d: Date, zone: string | undefined) {
  const p = parts(d, zone);
  return `${p.year}-${p.month}-${p.day}`;
}

export function formatWhen(iso: string, style: Style, zone?: string): string {
  const d = new Date(iso);
  const p = parts(d, zone);
  const time = `${p.hour}:${p.minute} ${p.dayPeriod?.toLowerCase() ?? ""}`.trim();

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (dayKey(d, zone) === dayKey(now, zone)) return `Today · ${time}`;
  if (dayKey(d, zone) === dayKey(tomorrow, zone)) return `Tomorrow · ${time}`;

  const thisYear = p.year === parts(now, zone).year;
  if (style === "short") {
    return `${p.weekday.slice(0, 3)} ${p.day} ${p.month.slice(0, 3)} · ${time}`;
  }
  return `${p.weekday} ${p.day} ${p.month}${thisYear ? "" : ` ${p.year}`} · ${time}`;
}

export default function LocalTime({ iso, style = "long" }: { iso: string; style?: Style }) {
  const zone = useSyncExternalStore(
    subscribe,
    () => undefined,
    () => SERVER_ZONE
  );
  return <time dateTime={iso}>{formatWhen(iso, style, zone)}</time>;
}
