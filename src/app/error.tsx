"use client";

import Link from "next/link";
import { useEffect } from "react";
import Logo from "@/components/Logo";
import { useT } from "@/i18n/client";

// Anything that goes wrong while a page is being made (the database
// having a moment, a service timing out) lands here instead of on a blank
// screen. Most of those are over in seconds, so the first thing offered is
// trying again, which re-fetches the page rather than just redrawing the
// broken one.
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useT();
  useEffect(() => {
    // Shows up in the server's logs (Cloudflare → Workers → packmates → Logs) with the digest, to match against the
    // server-side error if it ever needs looking into.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-sm px-4 py-20 text-center">
      <div className="flex justify-center mb-5">
        <Logo size={64} variant="white" className="lost-pin" />
      </div>
      <h1 className="text-2xl font-bold text-white drop-shadow">{t.oops.didntLoad}</h1>
      <div className="mt-6 flex flex-col items-center gap-3">
        <button type="button" onClick={() => retry()} className="pill-btn pill-black max-w-xs">
          {t.oops.tryAgain}
        </button>
        <Link href="/" className="text-sm font-medium text-white underline">
          {t.info.backToMap}
        </Link>
      </div>
    </div>
  );
}
