"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { callNative } from "@/lib/native";
import { BRAND } from "@/components/Logo";
import { Credits, Tiles, locationErrorMessage } from "@/components/ActivitiesMap";

/** Where exactly to meet, finer than the place name finds: the pin stays
 * in the middle and the map moves under it, so wherever the host drags
 * to is the spot. Easier with a thumb than dragging a small pin, which
 * the thumb also hides. A tap on the map moves there too, and "I'm here"
 * uses the phone's location, for a host standing at the spot. */
export default function PinPicker({
  start,
  onMove,
}: {
  start: { lat: number; lng: number };
  onMove: (lat: number, lng: number) => void;
}) {
  const [spot, setSpot] = useState(start);
  const [error, setError] = useState<string | null>(null);
  const move = (lat: number, lng: number) => {
    // About 10cm: more than any phone or map can tell apart.
    const round = (n: number) => Math.round(n * 1e6) / 1e6;
    setSpot({ lat: round(lat), lng: round(lng) });
    onMove(round(lat), round(lng));
  };

  return (
    <div>
      <div className="relative h-60 overflow-hidden rounded-xl border border-slate-200">
        <MapContainer center={[start.lat, start.lng]} zoom={17} maxZoom={19} className="h-full w-full" scrollWheelZoom={false}>
          <Tiles />
          <Credits />
          <Follow onMove={move} />
          <HereButton onError={setError} />
        </MapContainer>
        {/* The tip of the drop is the spot, at the map's exact middle. */}
        <svg
          viewBox="136 74 240 344"
          width="34"
          height="49"
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 z-[1000] -translate-x-1/2 -translate-y-full drop-shadow-md"
        >
          <path d="M256 74 q-120 0 -120 120 q0 90 120 224 q120 -134 120 -224 q0 -120 -120 -120 Z" fill={BRAND} />
          <circle cx="256" cy="196" r="52" fill="#fff" />
        </svg>
      </div>
      <p className="mt-2 text-sm text-slate-600">Drag the map to put the pin on the exact spot.</p>
      {error && (
        <p role="alert" className="mt-1 text-sm font-medium text-amber-800">
          {error}
        </p>
      )}
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
          Check on Google Maps ↗
        </a>
      </p>
    </div>
  );
}

/** Tells the form where the middle of the map is whenever it stops. */
function Follow({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const c = map.getCenter();
      onMove(c.lat, c.lng);
    },
    click: (e) => map.panTo(e.latlng),
  });
  return null;
}

function HereButton({ onError }: { onError: (message: string | null) => void }) {
  const map = useMap();
  const [finding, setFinding] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Taps on the button aren't taps on the map.
    if (wrapRef.current) L.DomEvent.disableClickPropagation(wrapRef.current);
  }, []);

  function found(lat: number, lng: number) {
    setFinding(false);
    onError(null);
    map.setView([lat, lng], 18);
  }
  function failed(code: number | undefined) {
    setFinding(false);
    onError(locationErrorMessage(code));
  }

  return (
    <div ref={wrapRef} className="absolute top-[10px] right-[10px] z-[1000]">
      <button
        type="button"
        aria-busy={finding}
        className="locate-btn"
        onClick={() => {
          setFinding(true);
          const options = { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 };
          // In the app, the phone's own location; on the website, the browser's.
          const native = callNative<{ coords: { latitude: number; longitude: number } }>(
            "Geolocation",
            "getCurrentPosition",
            options
          );
          if (native) {
            native
              .then(({ coords }) => found(coords.latitude, coords.longitude))
              .catch((e: { message?: string }) => failed(/denied|permission/i.test(e?.message ?? "") ? 1 : 2));
          } else if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (p) => found(p.coords.latitude, p.coords.longitude),
              (e) => failed(e.code),
              options
            );
          } else {
            failed(2);
          }
        }}
      >
        <span aria-hidden="true">📍</span>
        <span>{finding ? "Finding you…" : "I'm here"}</span>
      </button>
    </div>
  );
}
