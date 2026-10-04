"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** A small card floating over the bottom of the map: the one thing worth
 * telling this member right now (welcome, you've unlocked posting, thumbs
 * up the people from Saturday).
 *
 * Starts hidden and slides in once the page is running, rather than being
 * in the server HTML: whether it's been dismissed lives in this browser,
 * and rendering it first and hiding it after would flash it at everyone
 * who'd already closed it. */
export default function MapNotice({
  id,
  children,
  href,
  cta,
}: {
  // Remembered per id, so a new notice isn't hidden by closing an old one.
  id: string;
  children: React.ReactNode;
  href?: string;
  cta?: string;
}) {
  const key = `notice:${id}`;
  const [show, setShow] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(key) === "1";
    } catch {
      // Private mode or storage blocked: just show it.
    }
    if (!dismissed) setShow(true);
  }, [key]);

  if (!show) return null;

  function close() {
    setShow(false);
    try {
      localStorage.setItem(key, "1");
    } catch {
      // Nothing to remember it in; it'll be back next time, which is fine.
    }
  }

  return (
    <div className="map-notice" role="status">
      <div className="min-w-0 flex-1 text-sm text-slate-700">
        {children}
        {href && cta && (
          <Link href={href} className="mt-1 block font-semibold text-brand-700">
            {cta} →
          </Link>
        )}
      </div>
      <button
        type="button"
        onClick={close}
        aria-label="Close"
        className="-mr-1 -mt-1 flex h-8 w-8 flex-none items-center justify-center rounded-full text-lg text-slate-400 hover:bg-slate-100"
      >
        ×
      </button>
    </div>
  );
}
