"use client";

import { useState } from "react";

// `shown` is a shorter way to write the value on screen, when the whole
// thing would break across lines on a phone.
export default function CopyableField({ value, shown }: { value: string; shown?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be unavailable (older browsers, insecure
      // context); the value is still selectable text, so this is a
      // convenience, not something worth surfacing an error for.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="w-full flex items-center justify-between gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-mono text-left hover:bg-slate-100"
    >
      <span className="break-all">{shown ?? value}</span>
      <span className="shrink-0 text-sm font-sans font-medium text-brand-600">
        {copied ? "Copied ✓" : "Copy"}
      </span>
    </button>
  );
}
