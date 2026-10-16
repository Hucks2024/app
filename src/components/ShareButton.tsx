"use client";

import { useState } from "react";
import { callNative } from "@/lib/native";
import { useT } from "@/i18n/client";
import { fill } from "@/i18n/format";

/** Share a meetup: the phone's own share sheet (WhatsApp, Messages, …)
 * where there is one, otherwise the link goes on the clipboard. Bringing a
 * friend is the easiest way to make a first meetup less daunting. */
export default function ShareButton({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const t = useT();
  const text = fill(t.meetup.comeAlong, { title });

  async function share() {
    try {
      const native = callNative("Share", "share", { title, text, url });
      if (native) {
        await native;
        return;
      }
      if (navigator.share) {
        await navigator.share({ title, text, url });
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
      {copied ? t.meetup.linkCopied : t.meetup.share}
    </button>
  );
}
