"use client";

import { useEffect, useRef } from "react";

// Cloudflare Turnstile's "are you a person?" on the join form (see
// src/lib/turnstile.ts). Invisible unless Cloudflare isn't sure, when it
// shows a box to tap. It puts its answer in a hidden field of its own,
// cf-turnstile-response, which goes with the form.

type Turnstile = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let loading: Promise<Turnstile> | null = null;

/** Cloudflare's script, once, and only on the join form. */
function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("No Turnstile")));
    script.onerror = () => {
      loading = null;
      reject(new Error("Turnstile didn't load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export default function PersonCheck({ siteKey, resetOn }: { siteKey: string; resetOn: unknown }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);

  useEffect(() => {
    let gone = false;
    loadTurnstile()
      .then((turnstile) => {
        if (gone || !box.current) return;
        widget.current = turnstile.render(box.current, {
          sitekey: siteKey,
          appearance: "interaction-only",
          theme: "light",
          size: "flexible",
          language: "auto",
        });
      })
      // Nothing to show: joining then says it couldn't check.
      .catch(() => {});
    return () => {
      gone = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey]);

  // Each answer works once. After a try that came back with a problem,
  // a fresh one for the next.
  useEffect(() => {
    if (widget.current) window.turnstile?.reset(widget.current);
  }, [resetOn]);

  return <div ref={box} className="flex justify-center empty:hidden" />;
}
