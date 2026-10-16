"use client";

import Logo from "@/components/Logo";
import { useT } from "@/i18n/client";

// Shown the instant a link is tapped, while the next page is fetched, so a
// tap always does something you can see rather than leaving the old page
// sitting there looking ignored.
export default function Loading() {
  const t = useT();
  return (
    <div className="flex min-h-[60svh] items-center justify-center" role="status" aria-label={t.common.loading}>
      <span className="loading-pin">
        <Logo variant="white" size={44} />
      </span>
    </div>
  );
}
