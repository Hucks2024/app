"use client";

import { useEffect, useState } from "react";

// The inline script in layout.tsx already set (or didn't set) the "dark"
// class on <html> before this hydrates, so read that instead of guessing,
// keeps the button in sync with what's actually on screen.
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Private browsing etc, the toggle still works, it just won't
      // remember the choice on the next visit.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className="text-lg leading-none hover:scale-110 transition-transform"
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
