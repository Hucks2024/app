"use client";

import { startTransition, useActionState, useCallback, useRef, useState } from "react";
import { CATEGORIES, CATEGORY_GROUPS, categoryFor } from "@/lib/categories";
import { saveMeetupAction, type MeetupFormState } from "@/app/activities/actions";
import { geocodeLocation } from "@/lib/geocode";
import WhenPicker from "@/components/WhenPicker";

export type MeetupInitial = {
  id: string;
  title: string;
  category: string;
  location: string;
  findUs: string | null;
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

const STEPS = ["What", "Where", "When", "Name"] as const;

/** Posting a meetup, one question per screen; or editing one, all on one
 * page.
 *
 * One question at a time because that's what research on forms keeps
 * finding works best for people who aren't confident online, and it works
 * on a small screen. Editing is different: you came to change one thing,
 * so everything is laid out to find it.
 *
 * Every input stays in the one form whichever step is showing, and the
 * whole lot is sent once at the end. Sent by hand rather than through the
 * form's action prop, so a mistake comes back as a line of red with
 * everything still filled in. */
export default function MeetupForm({ initial }: { initial?: MeetupInitial }) {
  const editing = Boolean(initial);
  const [state, action, pending] = useActionState<MeetupFormState, FormData>(saveMeetupAction, {
    error: null,
  });
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [category, setCategory] = useState(initial?.category ?? "");
  const [place, setPlace] = useState<PlaceCheck>({ status: "idle" });
  const [when, setWhen] = useState<Date | null>(null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [titleTouched, setTitleTouched] = useState(editing);
  // An error is about the form as it was sent. Once they start fixing it,
  // it's out of date.
  const [edited, setEdited] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const lookingUp = useRef<{ text: string; result: Promise<PlaceCheck> } | null>(null);
  const onWhen = useCallback((d: Date | null) => setWhen(d), []);

  const saving = pending || place.status === "checking";
  // Distance, pace and a Strava route only mean something for a run, a
  // ride and the like; a painting meetup isn't asked for them.
  const route = categoryFor(category).route;
  const show = (i: number) => editing || step === i;

  function locationText(): string {
    return String(new FormData(formRef.current!).get("location") ?? "").trim();
  }

  /** Looks the place up from this browser, once per distinct text. */
  async function lookUp(text: string): Promise<PlaceCheck> {
    if (text.length < 3) return { status: "idle" };
    if (place.status !== "idle" && place.status !== "checking" && place.for === text) return place;
    // Tapping Next straight after typing asks again while the look-up from
    // leaving the box is still out: wait for that one rather than a second.
    if (lookingUp.current?.text === text) return lookingUp.current.result;
    setPlace({ status: "checking", for: text });
    const result = geocodeLocation(text).then((found): PlaceCheck => {
      const next: PlaceCheck =
        found.status === "found" ? { ...found, for: text } : { status: found.status, for: text };
      setPlace(next);
      if (lookingUp.current?.text === text) lookingUp.current = null;
      return next;
    });
    lookingUp.current = { text, result };
    return result;
  }

  /** A suggested name from what they've picked, until they type their own. */
  function suggestTitle(placeLabel?: string) {
    if (titleTouched) return;
    const kind = categoryFor(category).label.split(" / ")[0];
    const where = (placeLabel ?? locationText()).split(",")[0].trim();
    setTitle(where ? `${kind} at ${where}` : kind);
  }

  async function next() {
    setStepError(null);
    if (step === 0 && !category) return setStepError("Pick one.");
    if (step === 1) {
      const text = locationText();
      if (text.length < 3) return setStepError("Type where to meet.");
      const found = await lookUp(text);
      if (found.status === "not_found") {
        return setStepError(`Can't find "${text}". Add the town, like "Hyde Park, London".`);
      }
      suggestTitle(found.status === "found" ? found.label : undefined);
    }
    if (step === 2 && !when) return setStepError("Pick a day and time.");
    setStep(step + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    setStepError(null);
    setStep(Math.max(0, step - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <form
      ref={formRef}
      onChange={() => setEdited(true)}
      onSubmit={async (e) => {
        e.preventDefault();
        setEdited(false);
        if (!editing && step < STEPS.length - 1) return next();
        if (!when) return setStepError("Pick a day and time.");
        const text = locationText();
        // An edit that leaves the place alone keeps the pin it has.
        const found = initial && text === initial.location ? null : await lookUp(text);
        const data = new FormData(formRef.current!);
        if (found?.status === "found") {
          data.set("latitude", String(found.latitude));
          data.set("longitude", String(found.longitude));
          data.set("placeFor", found.for);
        }
        startTransition(() => action(data));
      }}
      className="card space-y-6"
      noValidate
    >
      {initial && <input type="hidden" name="activityId" value={initial.id} />}
      <input type="hidden" name="category" value={category} />

      {!editing && (
        <div aria-live="polite">
          <p className="text-sm font-semibold text-slate-600">
            Step {step + 1} of {STEPS.length}
          </p>
          <div className="mt-2 flex gap-1.5" aria-hidden="true">
            {STEPS.map((s, i) => (
              <span key={s} className={`h-2 flex-1 rounded-full ${i <= step ? "bg-brand-600" : "bg-slate-200"}`} />
            ))}
          </div>
        </div>
      )}

      {(state.error && !edited) || stepError ? (
        <p role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-base px-4 py-3">
          {stepError ?? state.error}
        </p>
      ) : null}

      {/* 1. What */}
      <fieldset hidden={!show(0)}>
        <legend className="mb-3 text-xl font-bold text-slate-900">What are you doing?</legend>
        {/* In groups, so two dozen choices read as four short lists. */}
        {[...CATEGORY_GROUPS, null].map((group) => (
          <div key={group ?? "other"} className="mb-4 last:mb-0">
            {group && <p className="type-group">{group}</p>}
            <div className="type-grid">
              {CATEGORIES.filter((c) => c.group === group).map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => {
                    setCategory(c.value);
                    setStepError(null);
                    setEdited(true);
                    // On the first step, picking one is the answer: straight on.
                    if (!editing) {
                      setStep(1);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  }}
                  className={`type-btn ${category === c.value ? "type-btn-on" : ""}`}
                  aria-pressed={category === c.value}
                >
                  <span className="text-3xl leading-none" aria-hidden="true">
                    {c.emoji}
                  </span>
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </fieldset>

      {/* 2. Where */}
      <fieldset hidden={!show(1)} className="space-y-4">
        <legend className="mb-1 text-xl font-bold text-slate-900">Where?</legend>
        <div>
          <label className="label !text-base" htmlFor="location">
            Meeting place
          </label>
          <p id="location-hint" className="text-sm text-slate-600 mb-2">
            e.g. Hyde Park Corner, London
          </p>
          <input
            className="input !text-base min-h-12"
            id="location"
            name="location"
            defaultValue={initial?.location}
            maxLength={200}
            autoComplete="off"
            aria-describedby="location-hint location-check"
            onBlur={(e) => void lookUp(e.target.value.trim())}
          />
          {/* A line's room kept for "Finding it…", so it appearing doesn't
              push Next down from under a finger mid-tap. */}
          <p id="location-check" className="mt-2 min-h-6 text-base" aria-live="polite">
            {place.status === "checking" && <span className="text-slate-600">Finding it…</span>}
            {place.status === "found" && (
              <span className="font-medium text-brand-700">📍 Found: {place.label}</span>
            )}
            {place.status === "not_found" && (
              <span className="font-medium text-amber-800">Can&apos;t find it. Add the town.</span>
            )}
          </p>
        </div>
        <div>
          <label className="label !text-base" htmlFor="findUs">
            How to spot you <span className="font-normal text-slate-600">(optional)</span>
          </label>
          <p id="findUs-hint" className="text-sm text-slate-600 mb-2">
            e.g. Yellow jacket, by the gate
          </p>
          <input
            className="input !text-base min-h-12"
            id="findUs"
            name="findUs"
            defaultValue={initial?.findUs ?? ""}
            maxLength={200}
            aria-describedby="findUs-hint"
          />
        </div>
      </fieldset>

      {/* 3. When */}
      <fieldset hidden={!show(2)}>
        <legend className="mb-3 text-xl font-bold text-slate-900">When?</legend>
        <WhenPicker initialIso={initial?.startsAt} onChange={onWhen} />
      </fieldset>

      {/* 4. Name and extras */}
      <fieldset hidden={!show(3)} className="space-y-4">
        <legend className="mb-1 text-xl font-bold text-slate-900">
          {editing ? "Name" : "Name it"}
        </legend>
        <div>
          <label className="label !text-base" htmlFor="title">
            Meetup name
          </label>
          <input
            className="input !text-base min-h-12"
            id="title"
            name="title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setTitleTouched(true);
            }}
            maxLength={120}
          />
          {!editing && (
            <p className="mt-1 text-sm text-slate-600">Change it if you like.</p>
          )}
        </div>

        <details
          className="rounded-xl border border-slate-200 px-4 py-2"
          open={Boolean(
            initial &&
              (initial.afterSpot || initial.distanceKm || initial.pace || initial.maxParticipants || initial.description || initial.stravaUrl)
          )}
        >
          <summary className="flex min-h-11 cursor-pointer select-none items-center text-base font-semibold text-brand-700">
            More (optional)
          </summary>
          <div className="space-y-4 py-3">
            <div>
              <label className="label !text-base" htmlFor="description">
                Notes
              </label>
              <textarea
                className="input !text-base"
                id="description"
                name="description"
                rows={3}
                maxLength={2000}
                defaultValue={initial?.description ?? ""}
              />
            </div>
            <div>
              <label className="label !text-base" htmlFor="afterSpot">
                After, we&apos;ll go to
              </label>
              <input
                className="input !text-base min-h-12"
                id="afterSpot"
                name="afterSpot"
                defaultValue={initial?.afterSpot ?? ""}
                maxLength={200}
              />
            </div>
            <div>
              <label className="label !text-base" htmlFor="maxParticipants">
                Max people
              </label>
              <input
                className="input !text-base min-h-12"
                id="maxParticipants"
                name="maxParticipants"
                type="number"
                inputMode="numeric"
                min="1"
                max="500"
                defaultValue={initial?.maxParticipants ?? ""}
                aria-describedby="max-hint"
              />
              <p id="max-hint" className="mt-1 text-sm text-slate-600">
                Empty = no limit
              </p>
            </div>
            {route && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label !text-base" htmlFor="distanceKm">
                      Distance (km)
                    </label>
                    <input
                      className="input !text-base min-h-12"
                      id="distanceKm"
                      name="distanceKm"
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0"
                      max="500"
                      defaultValue={initial?.distanceKm ?? ""}
                    />
                  </div>
                  <div>
                    <label className="label !text-base" htmlFor="pace">
                      Pace
                    </label>
                    <input
                      className="input !text-base min-h-12"
                      id="pace"
                      name="pace"
                      defaultValue={initial?.pace ?? ""}
                      maxLength={40}
                    />
                  </div>
                </div>
                <div>
                  <label className="label !text-base" htmlFor="stravaUrl">
                    Strava route link
                  </label>
                  <input
                    className="input !text-base min-h-12"
                    id="stravaUrl"
                    name="stravaUrl"
                    type="url"
                    inputMode="url"
                    defaultValue={initial?.stravaUrl ?? ""}
                    aria-describedby="strava-hint"
                  />
                  <p id="strava-hint" className="mt-1 text-sm text-amber-800">
                    Set the route to Public.
                  </p>
                </div>
              </>
            )}
          </div>
        </details>
      </fieldset>

      <div className="flex gap-3">
        {!editing && step > 0 && (
          <button type="button" onClick={back} className="btn-secondary min-h-12 px-5 text-base">
            ← Back
          </button>
        )}
        {/* Step 1 moves on when a type is tapped, so it has no Next. */}
        {(editing || step > 0) && (
          <button
            type="submit"
            // Not greyed out while the place is being found: leaving the box
            // starts that, and a button that greys out under the finger
            // swallows the tap. Next waits for the look-up itself.
            disabled={pending}
            aria-busy={saving}
            className="btn-primary min-h-12 flex-1 text-lg"
          >
            {saving && <span className="spinner mr-2" aria-hidden="true" />}
            {editing
              ? saving
                ? "Saving…"
                : "Save changes"
              : step < STEPS.length - 1
                ? place.status === "checking"
                  ? "Finding it…"
                  : "Next"
                : saving
                  ? "Posting…"
                  : "Post meetup 🎉"}
          </button>
        )}
      </div>
    </form>
  );
}
