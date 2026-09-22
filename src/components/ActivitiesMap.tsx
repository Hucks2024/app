"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import Link from "next/link";
import { format } from "date-fns";
import "leaflet/dist/leaflet.css";
import { categoryFor } from "@/lib/categories";
import { BRAND } from "@/components/Logo";

// The app's own logo as the map marker: the same teardrop from
// src/components/Logo.tsx, in the same brand violet, with the category
// emoji sitting in a white disc where the logo's three figures go.
//
// Built as a plain divIcon since Leaflet manages its icons as DOM outside
// React. Styling lives in globals.css (.map-pin and friends) because
// Tailwind can't reach markup handed over as a raw string, and can't do
// the keyframes either.
//
// The pin says what it is, how many are going and one face. Pace and
// duration used to hang underneath every pin as well; they belong in the
// list, where there's room to read them, rather than on a map where eight
// of them at once is just noise.
const PIN_W = 44;
const PIN_H = 63;

/** Who's going, for the faces on the pin. */
export type Face = { userId: string; hasPhoto: boolean };

function faceBubble(face: Face | undefined): string {
  if (!face) return "";
  // No photo is the common case early on, so the fallback is a real part
  // of the design rather than a broken image: the same disc, with the
  // club's own emoji in it.
  const inner = face.hasPhoto
    ? `<img src="/api/photos/profile/${face.userId}" alt="" loading="lazy">`
    : `<span>🙂</span>`;
  return `<span class="map-pin-face">${inner}</span>`;
}

/** A stable 0-2s offset for this pin's bob, derived from its id.
 *
 * Without it every pin on the map rises and falls in perfect lockstep,
 * which reads as one mechanism rather than a map full of separate things
 * going on. Derived from the id rather than the render order so a pin
 * doesn't change its rhythm when a filter reorders the list. */
function bobDelay(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 2000;
  // Negative, so the bob starts already in progress rather than every pin
  // waiting its turn to begin. Handed over as a custom property, not
  // animation-delay: the pin runs two animations and a plain delay would
  // apply to both, fast-forwarding the drop past its own end.
  return `-${hash}ms`;
}

function emojiIcon(emoji: string, going: number, face?: Face, id = "") {
  // A flat fill, so nothing here depends on a <defs> id. The gradient this
  // replaced needed one copy per marker with a unique id, or whichever
  // marker Leaflet unmounted first took the definition down and left the
  // rest unpainted.
  const svg = `
    <svg class="map-pin-svg" viewBox="136 74 240 344" aria-hidden="true">
      <path d="M256 74 q-120 0 -120 120 q0 90 120 224 q120 -134 120 -224 q0 -120 -120 -120 Z" fill="${BRAND}"/>
      <circle cx="256" cy="196" r="80" fill="#fff"/>
    </svg>`;
  // The count only earns its space once there's a group to speak of: a "1"
  // on every pin is noise, and an empty meetup advertising that it's empty
  // is worse than saying nothing.
  const count = going > 1 ? `<span class="map-pin-count">${going}</span>` : "";
  const html =
    `<div class="map-pin" style="--bob:${bobDelay(id)}">` +
    `${svg}<span class="map-pin-emoji">${emoji}</span>` +
    `${count}${faceBubble(face)}</div>`;

  return L.divIcon({
    html,
    className: "", // clear Leaflet's own default styling/background
    iconSize: [PIN_W, PIN_H],
    // The tip of the drop is what points at the location, so the anchor
    // sits at the bottom centre of the pin rather than its middle.
    iconAnchor: [PIN_W / 2, PIN_H],
    popupAnchor: [0, -PIN_H + 4],
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
  category: string;
  afterSpot: string | null;
  joinedCount: number;
  maxParticipants: number | null;
  // Up to a couple of people who've said they're going, for the faces on
  // the pin. Empty on the logged-out map: who is going is members-only,
  // and a face is a person.
  faces: Face[];
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
      map.set(
        a.id,
        emojiIcon(categoryFor(a.category).emoji, a.joinedCount, a.faces[0], a.id)
      );
    }
    return map;
  }, [activities]);

  // An empty map is still a map. It used to be replaced wholesale by a
  // card saying there was nothing on, which made a quiet week look like a
  // broken app: no map, no zoom, nothing to pan. Now the map is always
  // there and the message sits on top of it.
  const empty = activities.length === 0;

  // With one pin, centre on it. With several, frame them all: centring on
  // whichever happened to sort first could leave the rest off screen.
  // With none, a wide view of the city the club started in, which is at
  // least somewhere rather than the middle of the Atlantic, and the locate
  // button is right there to jump to wherever you actually are.
  const center: [number, number] = empty
    ? [51.5074, -0.1278]
    : [activities[0].latitude, activities[0].longitude];
  const bounds =
    activities.length > 1
      ? L.latLngBounds(activities.map((a) => [a.latitude, a.longitude] as [number, number])).pad(
          0.2
        )
      : undefined;

  return (
    <div className="map-shell relative w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
      <MapContainer
        center={center}
        zoom={empty ? 10 : 11}
        bounds={bounds}
        scrollWheelZoom
        className="h-full w-full"
      >
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
                    {a.maxParticipants ? ` / ${a.maxParticipants}` : ""} in 🙌
                  </p>
                  {a.afterSpot && (
                    <p className="text-sm text-slate-600">🍻 After: {a.afterSpot}</p>
                  )}
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
      {empty && (
        <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center p-6">
          <p className="pointer-events-auto rounded-2xl bg-white/95 px-4 py-3 text-center text-sm text-slate-600 shadow-lg dark:bg-slate-800/95">
            {restricted
              ? "Nothing on right now. Members see them the moment they're posted. 🗺️"
              : "Nothing on right now. Somebody has to go first 🤞"}
          </p>
        </div>
      )}
    </div>
  );
}
