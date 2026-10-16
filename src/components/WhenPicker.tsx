"use client";

import { useEffect, useMemo, useState } from "react";
import { clockTime, useTimePrefs, type DayWords, type TimePrefs } from "@/components/LocalTime";
import { useT } from "@/i18n/client";
import { fill } from "@/i18n/format";

// "When?" for posting a meetup: a row of days to tap, then a time.
//
// Replaces the browser's own date-and-time box, which is a different
// widget on every phone and a fiddly one on most. Days are buttons
// (Today, Tomorrow, Sat 11, …) because a meetup is nearly always in the
// next fortnight, and a time is a plain list, which people get through
// faster and with fewer mistakes than a calendar. Anything further off has
// "Another date".
//
// Works in this device's own time zone, and sends the moment as a full
// timestamp too (startsAtUtc), so the server never has to guess the zone.

const DAYS_SHOWN = 14;

function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** A time of day as this reader writes it: "07:00" or "7:00 AM". */
function timeLabel(minutes: number, prefs: TimePrefs): string {
  const d = new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60);
  return clockTime(d, { ...prefs, zone: undefined });
}

const TIMES = Array.from({ length: 96 }, (_, i) => i * 15);

/** "Tomorrow at 10:00", in the app's language ("at" is "{day} at {time}"). */
function describeWhen(day: string, minutes: number, prefs: TimePrefs, words: DayWords & { at: string }): string {
  const [y, mo, d] = day.split("-").map(Number);
  const date = new Date(y, mo - 1, d, Math.floor(minutes / 60), minutes % 60);
  const today = startOfDay(new Date());
  const diff = Math.round((startOfDay(date).getTime() - today.getTime()) / 86400000);
  const dayWords =
    diff === 0
      ? words.today
      : diff === 1
        ? words.tomorrow
        : date.toLocaleDateString(prefs.locale, { weekday: "long", day: "numeric", month: "long" });
  return fill(words.at, { day: dayWords, time: timeLabel(minutes, prefs) });
}

export default function WhenPicker({
  initialIso,
  onChange,
}: {
  initialIso?: string;
  // Told the chosen moment (or null while it's in the past / unset).
  onChange?: (when: Date | null) => void;
}) {
  // Everything here depends on this device's clock, zone and habits,
  // which the server can't know, so it's worked out once the page is
  // running (the first render matches the server's).
  const prefs = useTimePrefs();
  const t = useT();
  const [now, setNow] = useState<Date | null>(null);
  const [day, setDay] = useState<string>("");
  const [minutes, setMinutes] = useState<number>(10 * 60);
  const [otherDate, setOtherDate] = useState(false);

  useEffect(() => {
    const n = new Date();
    setNow(n);
    if (initialIso) {
      const d = new Date(initialIso);
      setDay(dayKey(d));
      setMinutes(d.getHours() * 60 + Math.floor(d.getMinutes() / 15) * 15);
      const inRow = (startOfDay(d).getTime() - startOfDay(n).getTime()) / 86400000;
      setOtherDate(inRow < 0 || inRow >= DAYS_SHOWN);
    }
  }, [initialIso]);

  const days = useMemo(() => {
    if (!now) return [];
    return Array.from({ length: DAYS_SHOWN }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      return {
        key: dayKey(d),
        top: i === 0 ? t.time.today : i === 1 ? t.time.tomorrow : d.toLocaleDateString(prefs.locale, { weekday: "short" }),
        bottom: d.toLocaleDateString(prefs.locale, { day: "numeric", month: "short" }),
      };
    });
  }, [now, prefs, t]);

  const when = useMemo(() => {
    if (!day) return null;
    const [y, mo, d] = day.split("-").map(Number);
    return new Date(y, mo - 1, d, Math.floor(minutes / 60), minutes % 60);
  }, [day, minutes]);
  const inPast = when != null && now != null && when.getTime() < Date.now();

  useEffect(() => {
    onChange?.(when && !inPast ? when : null);
  }, [when, inPast, onChange]);

  // Choosing today moves the time on to the next whole hour if the
  // default has already gone, so the first suggestion is always possible.
  function pickDay(key: string) {
    setDay(key);
    if (now && key === dayKey(now) && minutes <= now.getHours() * 60 + now.getMinutes()) {
      setMinutes(Math.min(23 * 60 + 45, (now.getHours() + 1) * 60));
    }
  }

  const localValue = when
    ? `${day}T${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
    : "";

  return (
    <div className="space-y-4">
      <input type="hidden" name="startsAt" value={localValue} />
      <input type="hidden" name="startsAtUtc" value={when ? when.toISOString() : ""} />

      <fieldset>
        <legend className="label !text-base">{t.when.whichDay}</legend>
        <div className="day-row" role="group">
          {days.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => {
                setOtherDate(false);
                pickDay(d.key);
              }}
              className={`day-btn ${!otherDate && day === d.key ? "day-btn-on" : ""}`}
              aria-pressed={!otherDate && day === d.key}
            >
              <span className="block font-bold">{d.top}</span>
              <span className="block text-sm">{d.bottom}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setOtherDate(true)}
            className={`day-btn ${otherDate ? "day-btn-on" : ""}`}
            aria-pressed={otherDate}
          >
            <span className="block font-bold">{t.when.another}</span>
            <span className="block text-sm">{t.when.date}</span>
          </button>
        </div>
        {otherDate && (
          <div className="mt-3">
            <label htmlFor="other-date" className="label">
              {t.when.pickDate}
            </label>
            <input
              id="other-date"
              type="date"
              className="input !text-base min-h-12"
              min={now ? dayKey(now) : undefined}
              value={day}
              onChange={(e) => pickDay(e.target.value)}
            />
          </div>
        )}
      </fieldset>

      <div>
        <label htmlFor="start-time" className="label !text-base">
          {t.when.whatTime}
        </label>
        <select
          id="start-time"
          className="input !text-base min-h-12"
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
        >
          {TIMES.map((m) => (
            <option key={m} value={m}>
              {timeLabel(m, prefs)}
            </option>
          ))}
        </select>
      </div>

      {when && (
        <p
          className={`rounded-xl px-4 py-3 text-base font-semibold ${
            inPast ? "bg-amber-50 text-amber-800" : "bg-brand-50 text-brand-800"
          }`}
          aria-live="polite"
        >
          {inPast ? t.when.gone : `🗓️ ${describeWhen(day, minutes, prefs, { ...t.time, at: t.when.at })}`}
        </p>
      )}
    </div>
  );
}
