"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { MapContainer, Marker, ZoomControl, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { BRAND } from "@/components/Logo";
import { Credits, LocateControl, Tiles } from "@/components/ActivitiesMap";
import { FlyTo, LONDON } from "@/components/PinPicker";
import { useT } from "@/i18n/client";

type Spot = { lat: number; lng: number };

/** Text from the host, made safe to put in the pin's HTML. */
function escape(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** The pin, its tip on the spot, with the host's comment above it (or an
 * invitation to add one). One tap target: tapping either opens the
 * comment. */
function pointIcon(bubble: string) {
  return L.divIcon({
    html:
      `<div class="point-pin"><span class="point-bubble">${escape(bubble)}</span>` +
      `<svg viewBox="136 74 240 344" width="44" height="63" aria-hidden="true">` +
      `<path d="M256 74 q-120 0 -120 120 q0 90 120 224 q120 -134 120 -224 q0 -120 -120 -120 Z" fill="${BRAND}"/>` +
      `<circle cx="256" cy="196" r="52" fill="#fff"/></svg></div>`,
    className: "",
    // Drawn from the spot upwards by .point-pin, whatever the bubble's width.
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

/** Step 2 of posting, the whole screen like the main map: search for the
 * place or tap the map to drop the pin, zoom in and drag it to the exact
 * spot, and tap the pin to add a comment ("By the gate, yellow jacket").
 * Laid over the page from <body>, between the top bar and the tabs; the
 * form keeps the values in hidden inputs. */
export default function MeetingPointMap({
  place,
  onPlace,
  onFind,
  status,
  error,
  spot,
  focus,
  onMark,
  comment,
  onComment,
  onBack,
  onNext,
  nextLabel,
  busy,
}: {
  place: string;
  onPlace: (text: string) => void;
  onFind: (text: string) => void;
  status: React.ReactNode;
  error: string | null;
  spot: Spot | null;
  focus: number;
  onMark: (lat: number, lng: number) => void;
  comment: string;
  onComment: (text: string) => void;
  onBack: () => void;
  onNext: () => void;
  nextLabel: string;
  busy: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  // Near me zooms in closer than a found place does.
  const [located, setLocated] = useState(0);
  // About 10cm: more than any phone or map can tell apart.
  const mark = (lat: number, lng: number) => onMark(Math.round(lat * 1e6) / 1e6, Math.round(lng * 1e6) / 1e6);

  // No pin, nothing to comment on.
  useEffect(() => {
    if (!spot) setOpen(false);
  }, [spot]);

  return createPortal(
    <div className="map-screen z-[1300]">
      <div className="map-shell map-full relative h-full w-full overflow-hidden">
        <MapContainer
          center={spot ? [spot.lat, spot.lng] : LONDON}
          zoom={spot ? 17 : 11}
          maxZoom={19}
          zoomControl={false}
          className="h-full w-full"
        >
          <ZoomControl position="bottomleft" />
          <Tiles />
          <Credits />
          <Point spot={spot} comment={comment} open={open} onMark={mark} onOpen={() => setOpen(true)} onClose={() => setOpen(false)} />
          <FlyTo spot={spot} trigger={focus} zoom={17} />
          <FlyTo spot={spot} trigger={located} zoom={18} />
          <LocateControl
            full
            onLocated={(lat, lng) => {
              mark(lat, lng);
              setLocated((n) => n + 1);
            }}
          />
        </MapContainer>
      </div>

      <div className="map-overlay-top">
        <div className="point-panel">
          <label htmlFor="location" className="block text-sm font-semibold text-slate-600">
            {t.form.meetingPoint}
          </label>
          <input
            id="location"
            className="input mt-1 !text-base min-h-12"
            value={place}
            placeholder={t.form.searchHint}
            maxLength={200}
            autoComplete="off"
            enterKeyHint="search"
            onChange={(e) => onPlace(e.target.value)}
            onBlur={(e) => onFind(e.target.value.trim())}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              // Away with the keyboard, so the map's in view; leaving the
              // box looks the place up.
              e.currentTarget.blur();
            }}
          />
          {/* Only when there's something to say: once the pin is down, the
              map shows where it is. */}
          <p id="location-check" className={`truncate text-base ${status || !spot ? "mt-1" : ""}`} aria-live="polite">
            {status ?? (!spot && <span className="text-slate-600">{t.form.orTapDrop}</span>)}
          </p>
          {error && (
            <p role="alert" className="mt-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-base text-red-700">
              {error}
            </p>
          )}
        </div>
      </div>

      {open && spot && (
        <div className="point-sheet card !p-4" role="dialog" aria-labelledby="point-comment-label">
          <label id="point-comment-label" htmlFor="point-comment" className="label !text-base">
            {t.form.comment} <span className="font-normal text-slate-600">{t.common.optional}</span>
          </label>
          <input
            id="point-comment"
            className="input !text-base min-h-12"
            value={comment}
            placeholder={t.form.spotYouHint}
            maxLength={200}
            autoFocus
            onChange={(e) => onComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                setOpen(false);
              }
            }}
          />
          <p className="mt-2 text-sm text-slate-600">
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
          <button type="button" onClick={() => setOpen(false)} className="btn-primary mt-3 min-h-12 w-full text-base">
            {t.common.done}
          </button>
        </div>
      )}

      <div className="point-actions">
        <button type="button" onClick={onBack} className="point-back">
          {t.common.back}
        </button>
        <button type="button" onClick={onNext} aria-busy={busy} className="btn-primary min-h-12 flex-1 text-lg">
          {busy && <span className="spinner mr-2" aria-hidden="true" />}
          {nextLabel}
        </button>
      </div>
    </div>,
    document.body
  );
}

/** The pin, and a tap on the map putting it there (or, with the comment
 * open, closing that instead). */
function Point({
  spot,
  comment,
  open,
  onMark,
  onOpen,
  onClose,
}: {
  spot: Spot | null;
  comment: string;
  open: boolean;
  onMark: (lat: number, lng: number) => void;
  onOpen: () => void;
  onClose: () => void;
}) {
  const t = useT();
  useMapEvents({ click: (e) => (open ? onClose() : onMark(e.latlng.lat, e.latlng.lng)) });
  const icon = useMemo(() => pointIcon(comment.trim() || `+ ${t.form.addComment}`), [comment, t]);
  if (!spot) return null;
  return (
    <Marker
      position={[spot.lat, spot.lng]}
      icon={icon}
      draggable
      title={t.form.meetingPoint}
      eventHandlers={{
        click: onOpen,
        dragend: (e) => {
          const at = (e.target as L.Marker).getLatLng();
          onMark(at.lat, at.lng);
        },
      }}
    />
  );
}
