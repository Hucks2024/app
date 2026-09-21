"use client";

import Link from "next/link";
import { format, isToday, isTomorrow } from "date-fns";
import { categoryFor } from "@/lib/categories";
import type { MapActivity } from "@/components/ActivitiesMap";

/** "Today · 6:00 am", else "Sat 27 Sep · 6:00 am". */
function when(iso: string): string {
  const d = new Date(iso);
  const time = format(d, "h:mm a");
  if (isToday(d)) return `Today · ${time}`;
  if (isTomorrow(d)) return `Tomorrow · ${time}`;
  return `${format(d, "EEE d MMM")} · ${time}`;
}

/** "in 20m", "in 3h" — but only while that's news.
 *
 * A countdown is the difference between a listing and something about to
 * happen, so it shows up inside the day and goes quiet beyond it, where
 * "in 6 days" tells you nothing the date didn't. */
function countdown(iso: string): string | null {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (minutes < 0) return "happening now";
  if (minutes < 5) return "starting now";
  if (minutes < 60) return `in ${minutes}m`;
  if (minutes < 60 * 24) return `in ${Math.round(minutes / 60)}h`;
  return null;
}

// The same meetups as the map, as rows. A map answers "what's near me";
// a list answers "what's on next", and sorted by start time it answers it
// better than squinting at pins does.
export default function MeetupList({
  activities,
  restricted,
}: {
  activities: MapActivity[];
  restricted: boolean;
}) {
  return (
    <ul className="space-y-2">
      {activities.map((a) => {
        const category = categoryFor(a.category);
        const soon = restricted ? null : countdown(a.startsAt);
        const row = (
          <div className="card !p-4 flex items-start gap-3 meetup-row">
            <span className="text-2xl leading-none shrink-0" aria-hidden="true">
              {category.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900 truncate">{a.title}</p>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                {restricted ? "Members see the time and place" : when(a.startsAt)}
                {soon && <span className="soon-badge">{soon}</span>}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {restricted ? "Somewhere round here" : a.location}
              </p>
              {/* The detail the pins no longer carry. */}
              {(a.distanceKm || a.pace) && (
                <p className="text-xs text-slate-500">
                  {[a.distanceKm ? `${a.distanceKm} km` : null, a.pace]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              {a.afterSpot && !restricted && (
                <p className="text-xs text-slate-500 truncate">🍻 After: {a.afterSpot}</p>
              )}
            </div>
            {!restricted && (
              <span className="shrink-0 text-xs font-semibold text-slate-500 whitespace-nowrap">
                {a.joinedCount > 0 ? `${a.joinedCount} in 🙌` : "be the first 🤞"}
              </span>
            )}
          </div>
        );
        // Logged out there's nothing to open: the detail page is
        // members-only, and a link straight to a login wall is a worse
        // answer than no link.
        return (
          <li key={a.id}>
            {restricted ? row : <Link href={`/activities/${a.id}`}>{row}</Link>}
          </li>
        );
      })}
    </ul>
  );
}
