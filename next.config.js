// Only this site's own scripts run, and pictures come only from here and
// the map tiles. Nothing from anywhere else gets in: no adverts, no
// trackers, and no way to frame the site inside another one.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://tile.openstreetmap.de",
  "font-src 'self' data:",
  "connect-src 'self' https://nominatim.openstreetmap.org https://photon.komoot.io",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
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
