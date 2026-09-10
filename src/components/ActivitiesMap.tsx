"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import Link from "next/link";
import { format } from "date-fns";
import "leaflet/dist/leaflet.css";

// A little variety instead of one identical pin everywhere, which emoji a
// run gets is picked deterministically from its id (see emojiFor below), so
// it stays the same run to run rather than flickering on re-render.
const PIN_EMOJIS = ["🏃", "🏃‍♀️", "🏃‍♂️", "🎽", "⚡", "🥇", "🌳", "🌲"];

function emojiFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PIN_EMOJIS[hash % PIN_EMOJIS.length];
}

// Pulls a "5:30"-style mm:ss out of a free-text pace field (the form just
// takes a string, e.g. "5:30 / km", "easy", "6 min miles"), so the pin
// label never has to show the raw "5:30 / km" clutter, just the number.
function paceMinutesPerKm(pace: string | null): number | null {
  if (!pace) return null;
  const match = pace.match(/(\d+)[:.](\d{2})/);
  if (!match) return null;
  return Number(match[1]) + Number(match[2]) / 60;
}

// One short label combining pace and an estimated total duration, as
// minimal as the data allows: both if both are derivable, just the pace
// if distance is missing, or nothing at all rather than showing a raw
// unparsed pace string.
function pinLabel(distanceKm: number | null, pace: string | null): string | null {
  const perKm = paceMinutesPerKm(pace);
  if (perKm == null) return null;

  const paceLabel = pace!.match(/\d+[:.]\d{2}/)![0].replace(".", ":");
  if (!distanceKm) return paceLabel;

  const totalMinutes = Math.round(distanceKm * perKm);
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return paceLabel;

  const remainder = totalMinutes % 60;
  const duration =
    totalMinutes < 60
      ? `${totalMinutes}m`
      : `${Math.floor(totalMinutes / 60)}h${remainder ? `${remainder}m` : ""}`;

  return `${paceLabel} · ${duration}`;
}

// A round, bouncing emoji bubble instead of Leaflet's default teardrop pin,
// built as a plain divIcon since Leaflet's icons are DOM elements it manages
// itself, outside React. Styling lives in globals.css (.map-pin / @keyframes
// map-pin-bob) since Tailwind can't apply arbitrary keyframe animations. The
// pace/duration label only renders when there's something short to show.
function emojiIcon(emoji: string, label: string | null) {
  const html = label
    ? `<div class="map-pin-wrap"><div class="map-pin"><span>${emoji}</span></div><div class="map-pin-label">${label}</div></div>`
    : `<div class="map-pin"><span>${emoji}</span></div>`;
  return L.divIcon({
    html,
    className: "", // clear Leaflet's own default styling/background
    iconSize: label ? [64, 54] : [40, 40],
    iconAnchor: label ? [32, 36] : [20, 36],
    popupAnchor: [0, -34],
  });
}

export type MapActivity = {
  id: string;
  title: string;
  location: string;
  startsAt: string; // serialized ISO date
  latitude: number;
  longitude: number;
  distanceKm: number | null;
  pace: string | null;
  joinedCount: number;
  maxParticipants: number | null;
};

export default function ActivitiesMap({
  activities,
  restricted = false,
}: {
  activities: MapActivity[];
  // When true, this is the public/logged-out view: pins sit at a jittered,
  // approximate position (done server-side, before this ever reaches the
  // browser, see "/"), and popups only tease a run rather than showing
  // exactly when/where it starts.
  restricted?: boolean;
}) {
  useEffect(() => {
    // react-leaflet mounts the map into a fixed-size container; if that
    // container was `hidden` (e.g. toggled from a List/Map tab) at mount
    // time, Leaflet caches a 0x0 size. Nudge it once the tab becomes
    // visible so tiles actually fill the box.
    const id = requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    return () => cancelAnimationFrame(id);
  }, []);

  const icons = useMemo(() => {
    const map = new Map<string, L.DivIcon>();
    for (const a of activities) {
      map.set(a.id, emojiIcon(emojiFor(a.id), pinLabel(a.distanceKm, a.pace)));
    }
    return map;
  }, [activities]);

  if (activities.length === 0) {
    return (
      <div className="card text-sm text-slate-600">
        None of the upcoming runs have a mappable location yet. 🗺️
      </div>
    );
  }

  const center: [number, number] = [activities[0].latitude, activities[0].longitude];

  return (
    <div className="h-[70vh] w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
      <MapContainer center={center} zoom={11} scrollWheelZoom className="h-full w-full">
        <TileLayer
          // CartoDB's "Voyager" tiles (used briefly here for a more
          // colorful look) started stamping "API KEY REQUIRED" across
          // every tile, their free/keyless tier apparently no longer
          // covers this. Plain OpenStreetMap tiles genuinely require no
          // key and no account, so that's what stays.
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {activities.map((a) => (
          <Marker key={a.id} position={[a.latitude, a.longitude]} icon={icons.get(a.id)}>
            <Popup>
              {restricted ? (
                <div className="space-y-1 max-w-[180px]">
                  <p className="font-semibold">{a.title}</p>
                  <p className="text-sm text-slate-500">
                    {a.distanceKm ? `${a.distanceKm} km run` : "Group run"} · roughly this area
                  </p>
                  <p className="text-sm text-slate-600">
                    Log in to see the exact time, meeting point, and join.
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Link href="/signup" className="text-brand-600 underline text-sm">
                      Join
                    </Link>
                    <Link href="/login" className="text-brand-600 underline text-sm">
                      Log in
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="font-semibold">{a.title}</p>
                  <p className="text-sm text-slate-600">
                    {format(new Date(a.startsAt), "EEE, MMM d · h:mm a")}
                  </p>
                  <p className="text-sm text-slate-600">{a.location}</p>
                  <p className="text-sm text-slate-500">
                    {a.distanceKm ? `${a.distanceKm} km · ` : ""}
                    {a.joinedCount}
                    {a.maxParticipants ? ` / ${a.maxParticipants}` : ""} joined
                  </p>
                  <Link href={`/activities/${a.id}`} className="text-brand-600 underline text-sm">
                    View run →
                  </Link>
                </div>
              )}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
