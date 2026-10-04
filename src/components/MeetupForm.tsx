"use client";

import { startTransition, useActionState, useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import { saveMeetupAction, type MeetupFormState } from "@/app/activities/actions";
import { geocodeLocation } from "@/lib/geocode";
import WhenInput from "@/components/WhenInput";

export type MeetupInitial = {
  id: string;
  title: string;
  category: string;
  location: string;
  startsAt: string;
  afterSpot: string | null;
  distanceKm: number | null;
  pace: string | null;
  maxParticipants: number | null;
  description: string | null;
  stravaUrl: string | null;
};

type PlaceCheck =
  | { status: "idle" }
  | { status: "checking"; for: string }
  | { status: "found"; for: string; label: string; latitude: number; longitude: number }
  | { status: "not_found" | "unavailable"; for: string };

/** Posting a meetup, and editing one: the same four questions either way.
 *
 * Sent by hand rather than through the form's action prop, so a mistake
 * comes back as a line of red with everything still filled in, instead of
 * a cleared form to start again. */
export default function MeetupForm({ initial }: { initial?: MeetupInitial }) {
  const [state, action, pending] = useActionState<MeetupFormState, FormData>(saveMeetupAction, {
    error: null,
  });
  const [place, setPlace] = useState<PlaceCheck>({ status: "idle" });
  // An error is about the form as it was sent. Once they start fixing it,
  // it's out of date, and leaving it up beside "📍 On the map" reads as if
  // the fix didn't work.
  const [edited, setEdited] = useState(false);
  // Busy from the tap, through the place lookup, until the save is back.
  const saving = pending || place.status === "checking";

  /** Looks the place up from this browser, once per distinct text. */
  async function lookUp(value: string): Promise<PlaceCheck> {
    const text = value.trim();
    if (text.length < 3) return { status: "idle" };
    if (place.status !== "idle" && place.status !== "checking" && place.for === text) return place;
    setPlace({ status: "checking", for: text });
    const result = await geocodeLocation(text);
    const next: PlaceCheck =
      result.status === "found" ? { ...result, for: text } : { status: result.status, for: text };
    setPlace(next);
    return next;
  }

  return (
    <form
      onChange={() => setEdited(true)}
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setEdited(false);
        // Make sure the pin was found for exactly what's in the box now
        // (pressing return skips the blur that normally does it). The
        // server looks it up itself if this came back empty.
        const text = String(new FormData(form).get("location") ?? "").trim();
        // An edit that leaves the place alone keeps the pin it has.
        const found = initial && text === initial.location ? null : await lookUp(text);
        const data = new FormData(form);
        if (found?.status === "found") {
          data.set("latitude", String(found.latitude));
          data.set("longitude", String(found.longitude));
          data.set("placeFor", found.for);
        }
        startTransition(() => action(data));
      }}
      className="card space-y-5"
    >
      {initial && <input type="hidden" name="activityId" value={initial.id} />}

      {state.error && !edited && (
        <p role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
          {state.error}
        </p>
      )}

      <div>
        <label className="label" htmlFor="category">
          1. What kind of meetup?
        </label>
        <select className="input" id="category" name="category" defaultValue={initial?.category ?? "RUN"}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.emoji}  {c.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="title">
          2. What&apos;s it called?
        </label>
        <input
          className="input"
          id="title"
          name="title"
          placeholder="Saturday morning 10K"
          defaultValue={initial?.title}
          required
          minLength={3}
          maxLength={120}
        />
      </div>
      <div>
        <label className="label" htmlFor="location">
          3. Where do you meet?
        </label>
        <input
          className="input"
          id="location"
          name="location"
          placeholder="Riverside Park, main entrance, London"
          defaultValue={initial?.location}
          required
          minLength={3}
          maxLength={200}
          onBlur={(e) => void lookUp(e.target.value)}
        />
        <p className="text-xs mt-1" aria-live="polite">
          {place.status === "checking" && <span className="text-slate-500">Finding it on the map…</span>}
          {place.status === "found" && <span className="text-brand-700">📍 On the map at {place.label}</span>}
          {place.status === "not_found" && (
            <span className="text-amber-700">
              Can&apos;t find that on the map. Add the area or a postcode.
            </span>
          )}
          {(place.status === "idle" || place.status === "unavailable") && (
            <span className="text-slate-500">A landmark and the area is plenty: we&apos;ll put it on the map.</span>
          )}
        </p>
      </div>
      <div>
        <label className="label" htmlFor="startsAt">
          4. When?
        </label>
        <WhenInput initialIso={initial?.startsAt} />
      </div>

      {/* Only four things are needed, so only four are shown. Everything
          else lives behind the expander, folded away unless editing
          something that already uses it. */}
      <details
        className="border-t border-slate-200 pt-4"
        open={Boolean(
          initial &&
            (initial.afterSpot || initial.distanceKm || initial.pace || initial.maxParticipants || initial.description || initial.stravaUrl)
        )}
      >
        <summary className="cursor-pointer select-none text-sm font-medium text-brand-700">
          Add more details (all optional)
        </summary>

        <div className="space-y-4 pt-4">
          <div>
            <label className="label" htmlFor="afterSpot">
              Going somewhere after?
            </label>
            <input
              className="input"
              id="afterSpot"
              name="afterSpot"
              placeholder="The Crown, 12 High Street"
              defaultValue={initial?.afterSpot ?? ""}
              maxLength={200}
            />
            <p className="text-xs text-slate-500 mt-1">
              The pub, the café, wherever. Name and rough location is plenty, it shows on the
              meetup so people can join just for that bit.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="distanceKm">
                Distance (km)
              </label>
              <input
                className="input"
                id="distanceKm"
                name="distanceKm"
                type="number"
                step="0.1"
                min="0"
                max="500"
                placeholder="10"
                defaultValue={initial?.distanceKm ?? ""}
              />
            </div>
            <div>
              <label className="label" htmlFor="pace">
                Pace
              </label>
              <input
                className="input"
                id="pace"
                name="pace"
                placeholder="6:00 / km"
                defaultValue={initial?.pace ?? ""}
                maxLength={40}
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Distance and pace only matter if you&apos;re moving, skip them for a coffee. No idea on
            pace? Leave it blank, or write what it feels like. Every pace is a real pace.
          </p>

          <div>
            <label className="label" htmlFor="maxParticipants">
              Max people
            </label>
            <input
              className="input"
              id="maxParticipants"
              name="maxParticipants"
              type="number"
              min="1"
              max="500"
              placeholder="Leave blank for no limit"
              defaultValue={initial?.maxParticipants ?? ""}
            />
          </div>
          <div>
            <label className="label" htmlFor="description">
              Anything else?
            </label>
            <textarea
              className="input"
              id="description"
              name="description"
              rows={3}
              maxLength={2000}
              placeholder="Route, what to bring, coffee after…"
              defaultValue={initial?.description ?? ""}
            />
          </div>
          <div>
            <label className="label" htmlFor="stravaUrl">
              Strava route
            </label>
            <input
              className="input"
              id="stravaUrl"
              name="stravaUrl"
              type="url"
              placeholder="https://www.strava.com/routes/..."
              defaultValue={initial?.stravaUrl ?? ""}
            />
            <p className="text-xs text-amber-700 mt-1">
              ⚠️ Set the route to <strong>Public</strong> in Strava, a private link won&apos;t open
              for anyone else.
            </p>
          </div>
        </div>
      </details>

      <button type="submit" disabled={saving} aria-busy={saving} className="btn-primary w-full !py-3">
        {saving && <span className="spinner mr-2" aria-hidden="true" />}
        {saving ? (initial ? "Saving…" : "Putting it on the map…") : initial ? "Save changes" : "Post meetup"}
      </button>
    </form>
  );
}
