"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { isToday, isWithinInterval, addDays, startOfDay } from "date-fns";
import MeetupList, { kmBetween } from "@/components/MeetupList";
import type { MapActivity } from "@/components/ActivitiesMap";
import { useT } from "@/i18n/client";
import { fill } from "@/i18n/format";
import { GENDER_EMOJI, type Gender } from "@/lib/gender";

function MapLoading() {
  const t = useT();
  return (
    <div className="map-shell w-full rounded-2xl border border-slate-200 bg-slate-100 shadow-sm flex items-center justify-center">
      <p className="text-base text-slate-600">{t.board.loading} 🗺️</p>
    </div>
  );
}


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
  loading: () => <MapLoading />,
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
  canPost = false,
  notice,
  stage = "fill",
  gender = null,
}: {
  activities: MapActivity[];
  // The logged-out preview: blurred pins, no filters, no list.
  restricted?: boolean;
  // "fill" is the members' full-screen map. "preview" is the front
  // door's fixed slice of map.
  stage?: "fill" | "preview";
  // Where "post a meetup" goes, offered on an empty map.
  post?: { href: string; label: string };
  // Whether this member can post yet (they've been to a meetup).
  canPost?: boolean;
  // A tip floating over the top of the map (see MapNotice).
  notice?: React.ReactNode;
  // Male, female or T-Rex: a button for just their own group's meetups.
  gender?: Gender | null;
}) {
  const [day, setDay] = useState<Day>("ANY");
  // Just the men-only, women-only or T-Rex-only ones for them.
  const [ownOnly, setOwnOnly] = useState(false);
  // Set once the viewer taps "Near me" and allows it; adds distances.
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  // The map, or the list laid over it.
  const [view, setView] = useState<"map" | "list">("map");
  const [farClosed, setFarClosed] = useState(false);
  const t = useT();

  const filtered = useMemo(
    () => activities.filter((a) => matchesDay(a.startsAt, day) && (!ownOnly || a.forWho === gender)),
    [activities, day, ownOnly, gender]
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

  const far = nearestKm != null && nearestKm > 50;
  const farCard = (
    <div className="card !p-4 text-base text-slate-700">
      <p className="font-bold text-slate-900">{t.board.nothingNear} 🌍</p>
      {canPost ? (
        <>
          <p className="mt-1">{t.board.beFirst}</p>
          <Link href="/activities/new" className="btn-primary mt-3 min-h-12 w-full text-base">
            {t.board.postFirst}
          </Link>
        </>
      ) : (
        <p className="mt-1">{t.board.goToOne}</p>
      )}
    </div>
  );

  // The whole screen is the map, the way travel apps do it: filters float
  // on top, Near me and List float at the bottom, and the list slides over
  // the map rather than replacing it, so the map keeps its place and the
  // "you are here" dot.
  return (
    <div className="map-screen">
      {/* Never swapped out for a card. The map handles having nothing on
          it, and taking it away because a filter matched nothing makes the
          app look broken rather than quiet. */}
      <ActivitiesMap
        activities={filtered}
        post={post}
        full
        showTimes={day === "TODAY"}
        onLocated={(lat, lng) => setHere({ lat, lng })}
      />

      {view === "list" && (
        <section className="list-panel" aria-labelledby="coming-up">
          <div className="mx-auto max-w-3xl px-4 pt-[72px] pb-28">
            <h2 id="coming-up" className="mb-3 text-lg font-bold text-white">
              {day === "TODAY" ? t.board.onToday : day === "WEEK" ? t.board.onThisWeek : t.board.comingUp} (
              {filtered.length !== total ? fill(t.board.nOfTotal, { n: filtered.length, total }) : filtered.length})
            </h2>
            {far && <div className="mb-3">{farCard}</div>}
            {filtered.length === 0 ? (
              <div className="card text-base text-slate-700">
                {t.board.nothingOn}
              </div>
            ) : (
              <MeetupList activities={filtered} here={here} />
            )}
          </div>
        </section>
      )}

      <div className="map-overlay-top">
        {/* Plain buttons: when, not what (the pins already say what), and
            just their own group's meetups. */}
        <div className="chip-row chip-row-float" role="group" aria-label={t.board.filter}>
          <button
            type="button"
            onClick={() => {
              setDay("ANY");
              setOwnOnly(false);
            }}
            className={`chip ${day === "ANY" && !ownOnly ? "chip-on" : ""}`}
            aria-pressed={day === "ANY" && !ownOnly}
          >
            {t.board.all} ({activities.length})
          </button>
          <button
            type="button"
            onClick={() => setDay(day === "TODAY" ? "ANY" : "TODAY")}
            className={`chip ${day === "TODAY" ? "chip-on" : ""}`}
            aria-pressed={day === "TODAY"}
          >
            {t.time.today}
          </button>
          <button
            type="button"
            onClick={() => setDay(day === "WEEK" ? "ANY" : "WEEK")}
            className={`chip ${day === "WEEK" ? "chip-on" : ""}`}
            aria-pressed={day === "WEEK"}
          >
            {t.board.thisWeek}
          </button>
          {/* Just the emoji, so the row fits on a phone; the words are
              for screen readers. */}
          {gender && (
            <button
              type="button"
              onClick={() => setOwnOnly(!ownOnly)}
              className={`chip chip-emoji ${ownOnly ? "chip-on" : ""}`}
              aria-pressed={ownOnly}
              aria-label={t.forWho[gender]}
              title={t.forWho[gender]}
            >
              {GENDER_EMOJI[gender]}
            </button>
          )}
        </div>
        {view === "map" && (notice || (far && !farClosed)) && (
          <div className="map-cards">
            {notice}
            {far && !farClosed && (
              <div className="relative">
                {farCard}
                <button
                  type="button"
                  onClick={() => setFarClosed(true)}
                  aria-label={t.common.close}
                  className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-2xl text-slate-500 hover:bg-slate-100"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setView(view === "map" ? "list" : "map")}
        className="view-toggle"
      >
        {view === "map" ? (
          <>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
              <rect x="3" y="5" width="3" height="3" rx="1" />
              <rect x="8" y="5.5" width="13" height="2" rx="1" />
              <rect x="3" y="10.5" width="3" height="3" rx="1" />
              <rect x="8" y="11" width="13" height="2" rx="1" />
              <rect x="3" y="16" width="3" height="3" rx="1" />
              <rect x="8" y="16.5" width="13" height="2" rx="1" />
            </svg>
            {t.board.list}
          </>
        ) : (
          <>
            <span aria-hidden="true">🗺️</span>
            {t.common.map}
          </>
        )}
      </button>
    </div>
  );
}
