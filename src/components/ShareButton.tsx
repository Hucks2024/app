"use client";

import { useState } from "react";

/** Share a meetup: the phone's own share sheet (WhatsApp, Messages, …)
 * where there is one, otherwise the link goes on the clipboard. Bringing a
 * friend is the easiest way to make a first meetup less daunting. */
export default function ShareButton({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title, text: `Come along: ${title}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Closing the share sheet counts as an error; nothing to say.
    }
  }

  return (
    <button type="button" onClick={share} className="tool-btn">
      <span aria-hidden="true">{copied ? "✅" : "📤"}</span>
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
