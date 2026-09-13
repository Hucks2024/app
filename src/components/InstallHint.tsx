"use client";

import { useEffect, useState } from "react";

const DISMISSED_KEY = "installHintDismissed";

// iOS has no install prompt: Safari will happily add the app to the home
// screen, but only if you already know to tap Share. Chrome and Android
// surface their own prompt, so this nudge is for iOS Safari only, and only
// before it's installed.
function shouldOffer(): boolean {
  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/.test(ua);
  if (!isIos) return false;

  // Already installed, launched from the icon.
  const standalone =
    ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone) ||
    window.matchMedia("(display-mode: standalone)").matches;
  if (standalone) return false;

  // In-app browsers (Instagram, Gmail and friends) have no Add to Home
  // Screen at all, so telling someone to tap Share would be a dead end.
  const realSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(ua);
  return realSafari;
}

export default function InstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
    } catch {
      // Private browsing: show it, worst case they dismiss it again.
    }
    setShow(shouldOffer());
  }, []);

  if (!show) return null;

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Nothing to do, it just reappears next visit.
    }
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 card !p-3 shadow-lg flex items-start gap-3">
      <span aria-hidden className="text-xl leading-none">
        🏃
      </span>
      <p className="text-sm text-slate-700 flex-1">
        Add Pacemates to your home screen: tap{" "}
        <span aria-hidden>⬆️</span> <strong>Share</strong>, then{" "}
        <strong>Add to Home Screen</strong>.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="text-slate-400 hover:text-slate-600 text-lg leading-none px-1"
      >
        ×
      </button>
    </div>
  );
}
