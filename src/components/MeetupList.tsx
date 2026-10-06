"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LocalTime from "@/components/LocalTime";
import { categoryFor } from "@/lib/categories";
import type { MapActivity } from "@/components/ActivitiesMap";

/** "in 20 min", "in 3 hours", but only while that's news.
 *
 * A countdown is the difference between a listing and something about to
 * happen, so it shows up inside the day and goes quiet beyond it, where
 * "in 6 days" tells you nothing the date didn't. */
function countdown(iso: string, now: number): string | null {
  const minutes = Math.round((new Date(iso).getTime() - now) / 60000);
  if (minutes < 0) return "Happening now";
  if (minutes < 5) return "Starting now";
  if (minutes < 60) return `In ${minutes} min`;
  if (minutes < 60 * 24) {
    const hours = Math.round(minutes / 60);
    return `In ${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return null;
}

/** Straight-line distance, in km, between two points on the globe. */
export function kmBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** "1.2 km away", or "0.8 miles away" where people think in miles (the
 * US and the UK). Only ever runs in the browser, after "Near me". */
function away(km: number): string {
  const miles = typeof navigator !== "undefined" && /^en-(US|GB)/i.test(navigator.language);
  if (miles) {
    const mi = km / 1.609344;
    if (mi < 0.1) return "Very close";
    return `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mile${mi >= 0.95 && mi < 1.05 ? "" : "s"} away`;
  }
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m away`;
  if (km < 10) return `${km.toFixed(1)} km away`;
  return `${Math.round(km)} km away`;
}

// The same meetups as the map, as rows, always under it. Research on
// finding places on a phone keeps finding the same thing: people do it
// faster and more accurately from a list than from a map, so the map says
// where and the list says what, when and who, readably.
export default function MeetupList({
  activities,
  here,
}: {
  activities: MapActivity[];
  // Where the viewer is, once they've tapped "Near me": adds "1.2 km away".
  here: { lat: number; lng: number } | null;
}) {
  // The clock only runs in the browser (the server's minute and the
  // phone's needn't agree), and ticks so "In 5 min" doesn't go stale on a
  // page left open.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <ul className="space-y-3">
      {activities.map((a) => {
        const category = categoryFor(a.category);
        const soon = now == null ? null : countdown(a.startsAt, now);
        const going = a.joinedCount;
        return (
          <li key={a.id}>
            <Link href={`/activities/${a.id}`} className="block">
              <div className="card !p-4 flex items-start gap-3 meetup-row">
                <span className="step-badge" aria-hidden="true">
                  {category.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-slate-900">{a.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-700">
                    <LocalTime iso={a.startsAt} style="short" />
                    {soon && <span className="soon-badge">{soon}</span>}
                  </p>
                  <p className="text-sm text-slate-600">
                    📍 {a.location}
                    {here && (
                      <span className="font-medium text-brand-700"> · {away(kmBetween(here, { lat: a.latitude, lng: a.longitude }))}</span>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {going > 1 ? `${going} going` : going === 1 ? "1 going so far" : "Be the first to go"}
                    {a.host && (
                      <>
                        {" · "}Host {a.host.name} 👍 {a.host.thumbs}
                      </>
                    )}
                  </p>
                </div>
                <span className="self-center text-xl text-slate-400" aria-hidden="true">
                  ›
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
