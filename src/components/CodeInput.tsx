"use client";

import { useRef } from "react";

/** The six-digit code box. Sends the form by itself the moment the sixth
 * digit is in (typed, pasted, or filled from the Mail app), so there's
 * nothing left to tap. Spaces are fine: "123 456" counts as six digits. */
export default function CodeInput({ describedBy }: { describedBy?: string }) {
  const sent = useRef(false);
  return (
    <input
      className="pill-input text-center font-mono !text-2xl tracking-[0.35em]"
      id="code"
      name="code"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9 ]*"
      maxLength={7}
      placeholder="123456"
      required
      autoFocus
      aria-describedby={describedBy}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        if (digits.length === 6 && !sent.current) {
          sent.current = true;
          e.target.form?.requestSubmit();
        } else if (digits.length < 6) {
          sent.current = false;
        }
      }}
    />
  );
}
