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
        const row = (
          <div className="card !p-4 flex items-start gap-3">
            <span className="text-2xl leading-none shrink-0" aria-hidden="true">
              {category.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900 truncate">{a.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {restricted ? "Members see the time and place" : when(a.startsAt)}
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
            {a.joinedCount > 0 && !restricted && (
              <span className="shrink-0 text-xs font-semibold text-slate-500 whitespace-nowrap">
                {a.joinedCount} going
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
