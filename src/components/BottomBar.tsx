"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The bottom tab bar on phones, for signed-in members.
//
// At the bottom because that's where a thumb reaches: most people hold a
// phone in one hand, and the top corners are the hardest place on the
// screen to tap. Every icon has its word under it, because people
// recognise very few icons reliably without one.

const TABS = [
  {
    href: "/",
    label: "Map",
    match: (p: string) => p === "/" || p === "/activities",
    icon: (
      <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4Zm0 0v13m6-10.5v13" />
    ),
  },
  {
    href: "/activities/new",
    label: "Post",
    match: (p: string) => p === "/activities/new",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8M8 12h8" />
      </>
    ),
  },
  {
    href: "/profile",
    label: "Me",
    match: (p: string) => p.startsWith("/profile"),
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" />
      </>
    ),
  },
  {
    href: "/help",
    label: "Help",
    match: (p: string) => p.startsWith("/help"),
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7" />
        <circle cx="12" cy="17" r="0.6" fill="currentColor" />
      </>
    ),
  },
];

export default function BottomBar() {
  const pathname = usePathname() ?? "/";
  return (
    <nav className="bottom-bar sm:hidden" aria-label="Main">
      {TABS.map((t) => {
        const active = t.match(pathname);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`bottom-tab ${active ? "bottom-tab-on" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <svg
              viewBox="0 0 24 24"
              width="26"
              height="26"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {t.icon}
            </svg>
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
