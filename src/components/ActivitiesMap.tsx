"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import Link from "next/link";
import { format } from "date-fns";
import "leaflet/dist/leaflet.css";

// Leaflet's default marker icons are image files referenced by relative
// path, which breaks once Next's bundler processes this file — the URLs it
// computes don't line up with where the images actually end up. Pointing
// the default icon at unpkg's copy of the same Leaflet version sidesteps
// that; it's a well-known workaround, not a Pacemates-specific hack.
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export type MapActivity = {
  id: string;
  title: string;
  location: string;
  startsAt: string; // serialized ISO date
  latitude: number;
  longitude: number;
  distanceKm: number | null;
  joinedCount: number;
  maxParticipants: number | null;
};

export default function ActivitiesMap({ activities }: { activities: MapActivity[] }) {
  useEffect(() => {
    // react-leaflet mounts the map into a fixed-size container; if that
    // container was `hidden` (e.g. toggled from a List/Map tab) at mount
    // time, Leaflet caches a 0x0 size. Nudge it once the tab becomes
    // visible so tiles actually fill the box.
    const id = requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    return () => cancelAnimationFrame(id);
  }, []);

  if (activities.length === 0) {
    return (
      <div className="card text-sm text-slate-600">
        None of the upcoming runs have a mappable location yet.
      </div>
    );
  }

  const center: [number, number] = [activities[0].latitude, activities[0].longitude];

  return (
    <div className="h-[70vh] w-full overflow-hidden rounded-xl border border-slate-200">
      <MapContainer center={center} zoom={11} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {activities.map((a) => (
          <Marker key={a.id} position={[a.latitude, a.longitude]} icon={defaultIcon}>
            <Popup>
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
                  View run
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
