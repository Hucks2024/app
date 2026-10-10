"use client";

import { useEffect, useState } from "react";
import { SITE } from "@/lib/site";

/** The contact address, put together in the browser rather than written
 * into the page, so it isn't in what a spam bot downloads: they collect
 * addresses by reading pages' HTML, and the ones that run a page like a
 * browser are turned away at the door (src/proxy.ts). Until it's put
 * together, and for anyone without JavaScript, it reads "hello at
 * packmates.live", which a person can still use. */
export default function ContactEmail({ className }: { className?: string }) {
  const [address, setAddress] = useState<string | null>(null);
  useEffect(() => {
    // The @ as a character code, so no step of building the site joins
    // it into one findable string either.
    setAddress(SITE.contactName + String.fromCharCode(64) + SITE.domain);
  }, []);
  if (!address) {
    return (
      <span className={className}>
        {SITE.contactName} at {SITE.domain}
      </span>
    );
  }
  return (
    <a href={`mailto:${address}`} className={className}>
      {address}
    </a>
  );
}
