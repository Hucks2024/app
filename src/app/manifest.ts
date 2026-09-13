import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

// Makes the site installable: on iPhone, Share -> Add to Home Screen gives
// a real icon that opens full screen with no address bar. Next.js serves
// this at /manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: SITE.name,
    description: SITE.description,
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    // Shown behind the app while it starts, so it matches the top of the
    // page gradient rather than flashing white.
    background_color: "#6d28d9",
    theme_color: "#6d28d9",
    categories: ["sports", "social", "lifestyle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android crops this to whatever shape the launcher uses, so the
      // runner sits well inside the safe area.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
