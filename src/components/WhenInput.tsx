"use client";

import { useEffect, useState } from "react";

/** The "when?" picker, plus the same moment as a full timestamp.
 *
 * A datetime-local box hands back a wall-clock time with no zone attached
 * ("2026-10-04T07:00"). Read on the server, that's UTC, so a 7am run in a
 * London summer used to be saved as 8am. The browser knows the zone, so it
 * does the converting, and the hidden field carries the answer. */
/** A moment as the picker writes it, in this device's own zone. */
function toPicker(d: Date): string {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export default function WhenInput({ initialIso }: { initialIso?: string }) {
  const [local, setLocal] = useState("");
  const [min, setMin] = useState<string | undefined>(undefined);

  useEffect(() => {
    // Both set after mount, because both depend on this device's zone,
    // which the server can't know: now (so past times are greyed out),
    // and, when editing, the meetup's existing time.
    setMin(toPicker(new Date()));
    if (initialIso) setLocal(toPicker(new Date(initialIso)));
  }, [initialIso]);

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
