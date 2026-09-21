"use client";

import { useEffect, useState } from "react";

// A small burst when you've just joined something. CSS only, no confetti
// library: a dozen spans on a keyframe cost nothing, and pulling in a
// canvas animation package to celebrate a button press would be a strange
// trade.
//
// Clears itself after a few seconds so it never becomes part of the
// furniture, and skips entirely for anyone who's asked their device to
// stop moving things.
const BITS = ["🎉", "🙌", "✨", "🎊", "👏", "⚡", "🥳", "💥", "🌟", "🤸", "🔥", "🎈"];

export default function JoinedBurst({ label }: { label: string }) {
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const quiet = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = setTimeout(() => setGone(true), quiet ? 2500 : 4200);
    return () => clearTimeout(id);
  }, []);

  if (gone) return null;

  return (
    <div className="mb-4 rounded-xl bg-brand-50 border border-brand-200 px-4 py-3 text-center dark:bg-brand-950 dark:border-brand-800">
      <p className="font-semibold text-brand-800 dark:text-brand-200">{label}</p>
      <div className="burst" aria-hidden="true">
        {BITS.map((bit, i) => (
          <span key={i} style={{ "--i": i } as React.CSSProperties}>
            {bit}
          </span>
        ))}
      </div>
    </div>
  );
}
