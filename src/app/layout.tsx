import type { Metadata, Viewport } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import BottomBar from "@/components/BottomBar";
import { getCurrentUser } from "@/lib/auth";
import InstallHint from "@/components/InstallHint";
import { SITE } from "@/lib/site";

// The stand-in for Segoe UI on devices that don't have it (see
// .font-wordmark in globals.css). Downloaded at build time and served from
// this domain, so a visitor's browser never talks to Google.
const openSans = Open_Sans({ subsets: ["latin"], variable: "--font-open-sans" });

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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    // One theme, so nothing has to be decided before paint: no
    // pre-hydration script, no flash, no per-device difference in what the
    // app looks like.
    <html lang="en" className={openSans.variable}>
      <body className={`min-h-screen flex flex-col ${user ? "has-bottom-bar" : ""}`}>
        <a href="#main" className="skip-link">
          Skip to the page
        </a>
        <Nav />
        <main id="main" className="flex-1">
          {children}
        </main>
        <InstallHint />
        {user && <BottomBar />}
      </body>
    </html>
  );
}
