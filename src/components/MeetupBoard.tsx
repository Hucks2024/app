"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { isToday, isWithinInterval, addDays, startOfDay } from "date-fns";
import { categoryFor } from "@/lib/categories";
import MeetupList from "@/components/MeetupList";
import type { MapActivity } from "@/components/ActivitiesMap";

// Leaflet reaches for `window` the moment it's imported, which is fatal on
// the server: any page rendering the map directly returns a 500 before a
// byte of HTML is sent. Loading it through next/dynamic with ssr:false
// keeps it out of the server bundle entirely, so the page renders and the
// map arrives once the browser has it.
//
// This wrapper is a client component because ssr:false is only allowed
// inside one, and the pages using the map are server components.
const ActivitiesMap = dynamic(() => import("@/components/ActivitiesMap"), {
  ssr: false,
  loading: () => (
    <div className="map-shell w-full rounded-2xl border border-slate-200 bg-slate-100 shadow-sm flex items-center justify-center">
      <p className="text-sm text-slate-500">Rounding everyone up… 🗺️</p>
    </div>
  ),
});

type Day = "ANY" | "TODAY" | "WEEK";

const DAYS: { value: Day; label: string }[] = [
  { value: "ANY", label: "Any day" },
  { value: "TODAY", label: "Today" },
  { value: "WEEK", label: "This week" },
];

function matchesDay(iso: string, day: Day): boolean {
  if (day === "ANY") return true;
  const d = new Date(iso);
  if (day === "TODAY") return isToday(d);
  return isWithinInterval(d, { start: startOfDay(new Date()), end: addDays(new Date(), 7) });
}

/** The whole browse experience: filter, then map or list.
 *
 * One component rather than filters-beside-a-map, because both views show
 * the same filtered set and a filter that only applied to one of them
 * would be a bug waiting to happen.
 */
export default function MeetupBoard({
  activities,
  restricted = false,
}: {
  activities: MapActivity[];
  restricted?: boolean;
}) {
  const [category, setCategory] = useState<string>("ALL");
  const [day, setDay] = useState<Day>("ANY");
  // Seeded from ?view=list so the choice survives a reload and can be
  // linked to. Read through useSearchParams rather than window.location,
  // which would give the server "map" and the browser "list" and leave
  // React reconciling a mismatch on every load.
  const params = useSearchParams();
  const [view, setView] = useState<"map" | "list">(
    params.get("view") === "list" ? "list" : "map"
  );

  // Only categories that actually have something in them get a chip: a row
  // of filters that all lead to "nothing here" is just clutter.
  const categoryChips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of activities) {
      if (!matchesDay(a.startsAt, day)) continue;
      counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([value, count]) => {
        // Label and emoji come from the catalogue, but the value stays the
        // one actually stored: categoryFor falls back to Run for anything
        // it doesn't recognise, and spreading that over the real value
        // would quietly point the chip at the wrong filter.
        const meta = categoryFor(value);
        return { value, count, label: meta.label, emoji: meta.emoji };
      })
      .sort((a, b) => b.count - a.count);
  }, [activities, day]);

  const filtered = useMemo(
    () =>
      activities.filter(
        (a) => matchesDay(a.startsAt, day) && (category === "ALL" || a.category === category)
      ),
    [activities, category, day]
  );

  const total = activities.filter((a) => matchesDay(a.startsAt, day)).length;

  return (
    <div>
      <div className="chip-row mb-3">
        <button
          type="button"
          onClick={() => setCategory("ALL")}
          className={`chip ${category === "ALL" ? "chip-on" : ""}`}
        >
          All ({total})
        </button>
        {/* One control rather than a chip each: three of the row's limited
            width went on a filter most people never touch. */}
        <label className={`chip ${day === "ANY" ? "" : "chip-on"}`}>
          <span aria-hidden="true">📅</span>
          <select
            value={day}
            onChange={(e) => setDay(e.target.value as Day)}
            className="bg-transparent border-0 p-0 pr-1 font-semibold text-inherit focus:outline-none cursor-pointer"
            aria-label="Which days"
          >
            {DAYS.map((d) => (
              <option key={d.value} value={d.value} className="text-slate-900">
                {d.label}
              </option>
            ))}
          </select>
        </label>
        {categoryChips.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setCategory(category === c.value ? "ALL" : c.value)}
            className={`chip ${category === c.value ? "chip-on" : ""}`}
          >
            <span aria-hidden="true">{c.emoji}</span>
            {c.label} ({c.count})
          </button>
        ))}
      </div>

      {view === "map" ? (
        // Never swapped out for a card. The map handles having nothing on
        // it, and taking it away because a filter matched nothing makes
        // the app look broken rather than quiet.
        <ActivitiesMap activities={filtered} restricted={restricted} />
      ) : filtered.length === 0 ? (
        <div className="card text-sm text-slate-600">
          Nothing doing on that one. Try another day, or clear the filter. 🤷
        </div>
      ) : (
        <MeetupList activities={filtered} restricted={restricted} />
      )}

      <div className="flex justify-center mt-3">
        <button
          type="button"
          onClick={() => setView(view === "map" ? "list" : "map")}
          className="chip"
        >
          {view === "map" ? "☰ List" : "🗺️ Map"}
        </button>
      </div>
    </div>
  );
}
