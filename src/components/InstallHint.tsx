"use client";

import { useEffect, useState } from "react";

const DISMISSED_KEY = "installHintDismissed";

// The event Chrome on Android fires when the app can be installed with one
// tap. Not in TypeScript's own types yet.
type InstallPrompt = Event & { prompt: () => Promise<void> };

type Offer = "iphone" | "android" | null;

// How to put the app on the home screen, for the phones where it isn't
// obvious. Not inside other apps' browsers (Instagram, Gmail and friends),
// which can't add to the home screen at all.
function offerFor(): Offer {
  const ua = navigator.userAgent;
  const installed =
    ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone) ||
    window.matchMedia("(display-mode: standalone)").matches;
  if (installed) return null;
  if (/iPhone|iPad|iPod/.test(ua)) {
    return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA|Instagram|FBAN|FBAV/.test(ua)
      ? "iphone"
      : null;
  }
  if (/Android/.test(ua)) {
    return /; wv\)|Instagram|FBAN|FBAV|FB_IAB|Snapchat|TikTok/.test(ua) ? null : "android";
  }
  return null;
}

export default function InstallHint() {
  const [offer, setOffer] = useState<Offer>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
    } catch {
      // Private browsing: show it, worst case they dismiss it again.
    }
    setOffer(offerFor());
    const keep = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", keep);
    return () => window.removeEventListener("beforeinstallprompt", keep);
  }, []);

  if (!offer) return null;

  function dismiss() {
    setOffer(null);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Nothing to do, it just reappears next visit.
    }
  }

  async function install() {
    await installPrompt?.prompt();
    dismiss();
  }

  return (
    // A card in the page, not floating over it: floating, it sat on top of
    // the Join button until it was closed.
    <div className="card mb-4 flex items-start gap-3 !p-3">
      <span aria-hidden className="text-xl leading-none">
        📲
      </span>
      <div className="flex-1">
        {offer === "iphone" ? (
          <p className="text-base text-slate-700">
            Get the app: tap <span aria-hidden>⬆️</span> <strong>Share</strong>, then{" "}
            <strong>Add to Home Screen</strong>.
          </p>
        ) : installPrompt ? (
          <button type="button" onClick={install} className="btn-primary min-h-12 w-full text-base">
            Get the app
          </button>
        ) : (
          <p className="text-base text-slate-700">
            Get the app: tap <strong>⋮</strong>, then <strong>Add to Home screen</strong>.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Close"
        className="-m-1 flex h-11 w-11 flex-none items-center justify-center rounded-full text-2xl leading-none text-slate-500 hover:bg-slate-100"
      >
        ×
      </button>
    </div>
  );
}
