import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import InstallHint from "@/components/InstallHint";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.name, template: `%s · ${SITE.name}` },
  description: SITE.description,
  openGraph: {
    title: SITE.name,
    description: SITE.description,
    url: SITE.url,
    siteName: SITE.name,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: SITE.name,
    description: SITE.description,
  },
  // Installable to the home screen, see src/app/manifest.ts. iOS ignores
  // the manifest's display mode and wants its own meta tags, which is what
  // appleWebApp emits, that's what strips the address bar once the icon is
  // launched.
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: SITE.name,
    statusBarStyle: "default",
  },
  other: {
    // Next.js emits the standardised "mobile-web-app-capable" for
    // appleWebApp.capable. Recent iOS opens home-screen sites full screen
    // regardless, but older versions only honour Apple's original spelling,
    // and without it the icon just reopens Safari, address bar and all.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  // Tints the bar above the page when installed. Matched to the nav rather
  // than the body gradient, so the two read as one surface.
  themeColor: "#6d28d9",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // One theme, so nothing has to be decided before paint: no
    // pre-hydration script, no flash, no per-device difference in what the
    // app looks like.
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <Nav />
        <main className="flex-1">{children}</main>
        <InstallHint />
        {/* White rather than slate: the footer sits on the page gradient,
            not on a card, and slate-on-magenta is close to invisible. */}
        <footer className="border-t border-white/15 py-6 text-center text-xs text-white/70">
          <p>
            {SITE.name} ·{" "}
            <a href={SITE.url} className="hover:text-white hover:underline" rel="noopener">
              {SITE.domain}
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}
