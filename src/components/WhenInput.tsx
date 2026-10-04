"use client";

import { useEffect, useState } from "react";

/** The "when?" picker, plus the same moment as a full timestamp.
 *
 * A datetime-local box hands back a wall-clock time with no zone attached
 * ("2026-10-04T07:00"). Read on the server, that's UTC, so a 7am run in a
 * London summer used to be saved as 8am. The browser knows the zone, so it
 * does the converting, and the hidden field carries the answer. */
export default function WhenInput() {
  const [local, setLocal] = useState("");
  const [min, setMin] = useState<string | undefined>(undefined);

  useEffect(() => {
    // Now, in the picker's own format, so past times are greyed out. Set
    // after mount: the server's "now" is in the wrong zone.
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setMin(d.toISOString().slice(0, 16));
  }, []);

  const utc = local ? new Date(local).toISOString() : "";

  return (
    <>
      <input
        className="input"
        id="startsAt"
        name="startsAt"
        type="datetime-local"
        required
        min={min}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
      />
      <input type="hidden" name="startsAtUtc" value={utc} />
    </>
  );
}
