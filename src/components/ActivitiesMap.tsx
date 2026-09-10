"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import Link from "next/link";
import { format } from "date-fns";
import "leaflet/dist/leaflet.css";

// A little variety instead of one identical pin everywhere, which emoji a
// run gets is picked deterministically from its id (see emojiFor below), so
// it stays the same run to run rather than flickering on re-render.
const PIN_EMOJIS = [
  "🏃",
  "🏃‍♀️",
  "🏃‍♂️",
  "🎽",
  "⚡",
  "🥇",
  "🌳", // park
  "🌲", // forest trail
  "⛲", // fountain / town square
  "🏞️", // riverside / nature park
  "🪑", // bench
  "☕", // café
  "🌉", // bridge
  "⛰️", // mountain trailhead
  "🏖️", // beach
  "🛝", // playground
];

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

// A button overlaid on the map (not a real Leaflet control, just a plain
// positioned element, react-leaflet renders any non-Leaflet child inside
// the map's own container div) that asks the browser for the visitor's
// location and drops a marker there. Leaflet's own map.locate() wraps the
// browser geolocation API and fires locationfound/locationerror on the map,
// so there's no need to touch navigator.geolocation directly.
// Mirrors the standard GeolocationPositionError codes Leaflet's
// locationerror event passes through (1 = permission denied, 2 = position
// unavailable, 3 = timed out). Permission denied is by far the most common
// one in practice, and it's rarely this site's fault: iOS blocks the
// request before a prompt ever shows if Location Services is off for
// Safari at the OS level, or if this site was denied before, so that one
// gets a much more specific, actionable message than the rest.
function locationErrorMessage(code: number | undefined): string {
  if (code === 1) {
    return "Location is blocked for this site. On iPhone: Settings → Privacy & Security → Location Services → Safari Websites should be \"While Using\", then tap the \"AA\" icon in Safari's address bar → Website Settings → Location → Allow, and try again.";
  }
  if (code === 3) {
    return "Finding your location took too long, try again, ideally outdoors or near a window.";
  }
  return "Couldn't get your location right now, try again in a moment.";
}

// A real popup dialog, not just a small note tucked next to the button, so
// a failure is impossible to miss regardless of screen size or where on
// the map the button happens to sit. Portaled to <body> so it always
// covers the full screen rather than being clipped by the map's own
// overflow: hidden.
function LocationErrorModal({ message, onClose }: { message: string; onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="location-error-title"
        onClick={(e) => e.stopPropagation()}
        className="card max-w-sm w-full"
      >
        <p id="location-error-title" className="font-semibold text-slate-900 mb-2">
          📍 Couldn&apos;t find you
        </p>
        <p className="text-sm text-slate-600 mb-4">{message}</p>
        <button ref={closeButtonRef} type="button" onClick={onClose} className="btn-primary w-full">
          Got it
        </button>
      </div>
    </div>,
    document.body,
  );
}

function LocateControl() {
  const leafletMap = useMap();
  const [status, setStatus] = useState<"idle" | "locating" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);

  useEffect(() => {
    // Stop clicks/scrolls on the button reaching Leaflet underneath, same
    // trick L.Control uses internally, otherwise a tap here also pans or
    // zooms the map.
    if (wrapRef.current) {
      L.DomEvent.disableClickPropagation(wrapRef.current);
      L.DomEvent.disableScrollPropagation(wrapRef.current);
    }
  }, []);

  useEffect(() => {
    function onFound(e: L.LocationEvent) {
      setStatus("idle");
      if (markerRef.current) leafletMap.removeLayer(markerRef.current);
      markerRef.current = L.circleMarker(e.latlng, {
        radius: 8,
        color: "#fff",
        weight: 3,
        fillColor: "#2563eb",
        fillOpacity: 1,
      })
        .addTo(leafletMap)
        .bindPopup("You are here");
    }
    function onError(e: L.ErrorEvent) {
      setStatus("error");
      setErrorMessage(locationErrorMessage(e.code));
    }
    leafletMap.on("locationfound", onFound);
    leafletMap.on("locationerror", onError);
    return () => {
      leafletMap.off("locationfound", onFound);
      leafletMap.off("locationerror", onError);
      if (markerRef.current) leafletMap.removeLayer(markerRef.current);
    };
  }, [leafletMap]);

  return (
    <>
      <div ref={wrapRef} className="absolute top-3 right-3 z-[1000]">
        <button
          type="button"
          onClick={() => {
            setStatus("locating");
            leafletMap.locate({
              setView: true,
              maxZoom: 15,
              enableHighAccuracy: true,
              timeout: 20000,
              // Reuse a fix from the last minute instead of always forcing a
              // brand new GPS lock, cuts down on spurious timeouts.
              maximumAge: 60000,
            });
          }}
          aria-label="Show my location"
          title="Show my location"
          className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center text-base hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          {status === "locating" ? "⏳" : "📍"}
        </button>
      </div>
      {status === "error" && errorMessage && (
        <LocationErrorModal message={errorMessage} onClose={() => setStatus("idle")} />
      )}
    </>
  );
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
    <div className="map-shell w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
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
        <LocateControl />
        {activities.map((a) => (
          <Marker key={a.id} position={[a.latitude, a.longitude]} icon={icons.get(a.id)}>
            <Popup>
              {restricted ? (
                <div className="space-y-1 max-w-[180px]">
                  <p className="font-semibold">{a.title} 🏃</p>
                  <p className="text-sm text-slate-500">
                    {a.distanceKm ? `${a.distanceKm} km` : "Group run"} · somewhere round here 👀
                  </p>
                  <p className="text-sm text-slate-600">
                    The exact time and meeting point are our little secret, for members only. 🤫
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Link href="/signup" className="text-brand-600 underline text-sm font-medium">
                      I&apos;m in →
                    </Link>
                    <Link href="/login" className="text-brand-600 underline text-sm">
                      Log in
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="font-semibold">{a.title} 🏃</p>
                  <p className="text-sm text-slate-600">
                    {format(new Date(a.startsAt), "EEE, MMM d · h:mm a")}
                  </p>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${a.latitude},${a.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-slate-600 underline block"
                  >
                    {a.location} ↗
                  </a>
                  <p className="text-sm text-slate-500">
                    {a.distanceKm ? `${a.distanceKm} km · ` : ""}
                    {a.joinedCount}
                    {a.maxParticipants ? ` / ${a.maxParticipants}` : ""} laced up 👟
                  </p>
                  <Link
                    href={`/activities/${a.id}`}
                    className="text-brand-600 underline text-sm font-medium"
                  >
                    Let&apos;s go →
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
