"use client";

import dynamic from "next/dynamic";
import type { MapActivity } from "@/components/ActivitiesMap";

// Leaflet reaches for `window` the moment it's imported, which is fatal on
// the server: any page rendering the map directly returns a 500 before a
// byte of HTML is sent. Loading it through next/dynamic with ssr:false
// keeps it out of the server bundle entirely, so the page renders and the
// map arrives once the browser has it.
//
// This wrapper exists because ssr:false is only allowed inside a client
// component, and the pages using the map are server components.
const ActivitiesMap = dynamic(() => import("@/components/ActivitiesMap"), {
  ssr: false,
  loading: () => (
    <div className="map-shell w-full rounded-2xl border border-slate-200 bg-slate-100 shadow-sm flex items-center justify-center">
      <p className="text-sm text-slate-500">Loading the map…</p>
    </div>
  ),
});

export default function MapPanel(props: { activities: MapActivity[]; restricted?: boolean }) {
  return <ActivitiesMap {...props} />;
}
