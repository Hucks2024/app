import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <Nav />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
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
