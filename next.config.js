// Only this site's own scripts run, and pictures come only from here and
// the map. Nothing from anywhere else gets in: no adverts, no trackers,
// and no way to frame the site inside another one. The map is OpenFreeMap
// (fetched, and drawn by MapLibre in workers it starts from blob: URLs),
// with OpenStreetMap's picture tiles as its stand-in. Cloudflare's
// "are you a person?" check on joining (src/lib/turnstile.ts) is the one
// script and frame from elsewhere.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "frame-src https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://tile.openstreetmap.de",
  "font-src 'self' data:",
  "connect-src 'self' https://tiles.openfreemap.org https://nominatim.openstreetmap.org https://photon.komoot.io",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Named here so the Cloudflare build (OpenNext) copies Prisma whole,
  // with its Workers version, not just the files a Node server would use.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  async headers() {
    return [
      {
        // MapLibre's worker: its link carries its version (see
        // ActivitiesMap.tsx), so phones can keep it until that changes.
        source: "/maplibre-worker.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  // Profile photos are shrunk in the browser before they're sent, so they
  // arrive at a couple of hundred KB. This is the backstop for a phone
  // that can't shrink one; Vercel itself stops at 4.5MB.
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

module.exports = nextConfig;
