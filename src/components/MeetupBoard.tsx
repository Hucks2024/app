"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { isToday, isWithinInterval, addDays, startOfDay } from "date-fns";
import { categoryFor } from "@/lib/categories";
import MeetupList, { kmBetween } from "@/components/MeetupList";
import type { MapActivity } from "@/components/ActivitiesMap";

const SITE_NAME = "packmates";

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
      <p className="text-base text-slate-600">Loading the map… 🗺️</p>
    </div>
  ),
});

type Day = "ANY" | "TODAY" | "WEEK";

function matchesDay(iso: string, day: Day): boolean {
  if (day === "ANY") return true;
  const d = new Date(iso);
  if (day === "TODAY") return isToday(d);
  return isWithinInterval(d, { start: startOfDay(new Date()), end: addDays(new Date(), 7) });
}

/** The whole browse experience: filter, the map, and the list under it.
 *
 * One component, because the map and the list show the same filtered set
 * and a filter that only applied to one of them would be a bug waiting to
 * happen.
 */
export default function MeetupBoard({
  activities,
  restricted = false,
  post,
  notice,
  stage = "fill",
}: {
  activities: MapActivity[];
  // The logged-out preview: blurred pins, no filters, no list.
  restricted?: boolean;
  // "fill" is the members' screen (map, then the list). "preview" is the
  // front door's fixed slice of map.
  stage?: "fill" | "preview";
  // Where "post a meetup" goes, offered on an empty map.
  post?: { href: string; label: string };
  // A tip floating over the bottom of the map (see MapNotice).
  notice?: React.ReactNode;
}) {
  const [category, setCategory] = useState<string>("ALL");
  const [day, setDay] = useState<Day>("ANY");
  // Set once the viewer taps "Near me" and allows it; adds distances.
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);

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

  // Once we know where they are: how far the nearest meetup is. Far away
  // means this app hasn't reached them yet, which is worth saying plainly
  // rather than leaving them to work out why London is on their map.
  const nearestKm = useMemo(() => {
    if (!here || activities.length === 0) return null;
    return Math.min(...activities.map((a) => kmBetween(here, { lat: a.latitude, lng: a.longitude })));
  }, [here, activities]);

  if (restricted) {
    return (
      <div className={`board-stage relative ${stage === "preview" ? "board-stage-preview" : ""}`}>
        <ActivitiesMap activities={filtered} restricted />
      </div>
    );
  }

  return (
    <div>
      {/* Plain buttons rather than a dropdown: with this few options, every
          one visible is quicker than opening a menu to find them. */}
      <div className="chip-row mb-3" role="group" aria-label="Filter meetups">
        <button
          type="button"
          onClick={() => {
            setCategory("ALL");
            setDay("ANY");
          }}
          className={`chip ${category === "ALL" && day === "ANY" ? "chip-on" : ""}`}
          aria-pressed={category === "ALL" && day === "ANY"}
        >
          All ({activities.length})
        </button>
        <button
          type="button"
          onClick={() => setDay(day === "TODAY" ? "ANY" : "TODAY")}
          className={`chip ${day === "TODAY" ? "chip-on" : ""}`}
          aria-pressed={day === "TODAY"}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => setDay(day === "WEEK" ? "ANY" : "WEEK")}
          className={`chip ${day === "WEEK" ? "chip-on" : ""}`}
          aria-pressed={day === "WEEK"}
        >
          This week
        </button>
        {categoryChips.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setCategory(category === c.value ? "ALL" : c.value)}
            className={`chip ${category === c.value ? "chip-on" : ""}`}
            aria-pressed={category === c.value}
          >
            <span aria-hidden="true">{c.emoji}</span>
            {c.label} ({c.count})
          </button>
        ))}
      </div>

      <div className="board-stage board-stage-split relative">
        {/* Never swapped out for a card. The map handles having nothing on
            it, and taking it away because a filter matched nothing makes
            the app look broken rather than quiet. */}
        <ActivitiesMap
          activities={filtered}
          post={post}
          onLocated={(lat, lng) => setHere({ lat, lng })}
        />
        {notice}
      </div>

      <section className="mt-5" aria-labelledby="coming-up">
        <h2 id="coming-up" className="mb-3 text-lg font-bold text-white">
          {day === "TODAY" ? "On today" : day === "WEEK" ? "On this week" : "Coming up"} (
          {filtered.length}
          {filtered.length !== total ? ` of ${total}` : ""})
        </h2>
        {nearestKm != null && nearestKm > 50 && (
          <div className="card mb-3 !p-4 text-base text-slate-700">
            <p className="font-bold text-slate-900">Nothing near you yet 🌍</p>
            <p className="mt-1">
              {SITE_NAME} is new where you are. Know people nearby who&apos;d come along? Send them the
              link, and the first meetup near you could be yours.
            </p>
          </div>
        )}
        {filtered.length === 0 ? (
          <div className="card text-base text-slate-700">
            Nothing on for that. Try another day, or tap <strong>All</strong>.
          </div>
        ) : (
          <MeetupList activities={filtered} here={here} />
        )}
      </section>
    </div>
  );
}
