"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { BRAND } from "@/components/Logo";
import { Credits, LocateControl, Tiles } from "@/components/ActivitiesMap";
import { useT } from "@/i18n/client";

// Where the map opens with nothing found or marked yet: London, like the
// main map.
export const LONDON: [number, number] = [51.5074, -0.1278];

// The app's teardrop with a white dot, its tip on the spot.
const PIN = L.divIcon({
  html: `<svg viewBox="136 74 240 344" width="40" height="57" aria-hidden="true" style="filter: drop-shadow(0 3px 4px rgb(0 0 0 / 0.35))">
    <path d="M256 74 q-120 0 -120 120 q0 90 120 224 q120 -134 120 -224 q0 -120 -120 -120 Z" fill="${BRAND}"/>
    <circle cx="256" cy="196" r="52" fill="#fff"/></svg>`,
  className: "",
  iconSize: [40, 57],
  iconAnchor: [20, 57],
});

/** The meeting point, marked on a map: tap where it is (zooming in to get
 * it exact), drag the pin, or Near me to put it where the host is
 * standing. `focus` changes when the form finds a place from its name, to
 * bring the map there. */
export default function PinPicker({
  spot,
  focus,
  onMark,
}: {
  spot: { lat: number; lng: number } | null;
  focus: number;
  onMark: (lat: number, lng: number) => void;
}) {
  const t = useT();
  // Near me zooms in closer than a found place does.
  const [located, setLocated] = useState(0);
  // About 10cm: more than any phone or map can tell apart.
  const mark = (lat: number, lng: number) => onMark(Math.round(lat * 1e6) / 1e6, Math.round(lng * 1e6) / 1e6);

  return (
    <div>
      <div className="relative h-72 overflow-hidden rounded-xl border border-slate-200">
        <MapContainer
          center={spot ? [spot.lat, spot.lng] : LONDON}
          zoom={spot ? 17 : 11}
          maxZoom={19}
          className="h-full w-full"
          scrollWheelZoom={false}
        >
          <Tiles />
          <Credits />
          <Mark spot={spot} onMark={mark} />
          <FlyTo spot={spot} trigger={focus} zoom={17} />
          <FlyTo spot={spot} trigger={located} zoom={18} />
          <LocateControl
            onLocated={(lat, lng) => {
              mark(lat, lng);
              setLocated((n) => n + 1);
            }}
          />
        </MapContainer>
      </div>
      {spot ? (
        <>
          <p className="mt-2 text-sm text-slate-600">{t.form.tapOrDrag}</p>
          <p className="mt-1 text-sm text-slate-600">
            <span className="tabular-nums">
              {spot.lat.toFixed(5)}, {spot.lng.toFixed(5)}
            </span>
            {" · "}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-brand-700 underline"
            >
              {t.form.checkGoogle} ↗
            </a>
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-slate-600">{t.form.orTapMark}</p>
      )}
    </div>
  );
}

/** The pin, and a tap anywhere on the map moving it there. */
function Mark({ spot, onMark }: { spot: { lat: number; lng: number } | null; onMark: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onMark(e.latlng.lat, e.latlng.lng) });
  if (!spot) return null;
  return (
    <Marker
      position={[spot.lat, spot.lng]}
      icon={PIN}
      draggable
      eventHandlers={{
        dragend: (e) => {
          const at = (e.target as L.Marker).getLatLng();
          onMark(at.lat, at.lng);
        },
      }}
    />
  );
}

/** Takes the map to the spot whenever `trigger` changes (not when it first
 * opens: it opens there already). */
export function FlyTo({ spot, trigger, zoom }: { spot: { lat: number; lng: number } | null; trigger: number; zoom: number }) {
  const map = useMap();
  const last = useRef(trigger);
  useEffect(() => {
    if (trigger === last.current) return;
    last.current = trigger;
    if (spot) map.setView([spot.lat, spot.lng], zoom);
  }, [map, spot, trigger, zoom]);
  return null;
}
