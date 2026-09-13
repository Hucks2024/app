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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#6d28d9" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Runs before paint/hydration so there's no flash of the wrong
            theme: reads the saved choice (or falls back to the OS
            preference) and stamps the "dark" class straight onto <html>,
            the same class ThemeToggle toggles later. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark");}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col">
        <Nav />
        <main className="flex-1">{children}</main>
        <InstallHint />
        <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
          <p>
            {SITE.name} ·{" "}
            <a
              href={SITE.url}
              className="hover:text-brand-700 hover:underline"
              rel="noopener"
            >
              {SITE.domain}
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}
