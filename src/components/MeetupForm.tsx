"use client";

import { startTransition, useActionState, useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { DURATIONS, categoryFor, kmFrom, oneEmoji } from "@/lib/categories";
import { FOR_WHO_EMOJI, FOR_WHO_PICKS, forWhoChoices } from "@/lib/gender";
import PickOne from "@/components/PickOne";
import { saveMeetupAction, type MeetupFormState } from "@/app/activities/actions";
import { geocodeLocation, placeName } from "@/lib/geocode";
import WhenPicker from "@/components/WhenPicker";
import { useLocale, useT } from "@/i18n/client";
import { commentHint, fill, howLong, typeName } from "@/i18n/format";

// Only in the browser (Leaflet needs a window), and only once the
// meeting point step is showing. The same height while it loads, so
// nothing below jumps.
const PinPicker = dynamic(() => import("@/components/PinPicker"), {
  ssr: false,
  loading: () => <div className="h-72 rounded-xl border border-slate-200 bg-slate-100" />,
});
const MeetingPointMap = dynamic(() => import("@/components/MeetingPointMap"), {
  ssr: false,
  loading: () => <div className="map-screen z-[1300] bg-slate-100" />,
});

// The few most people want, as buttons, so the first question is one
// glance. Anything else is typed in: its own name, and an emoji for its pin.
const POPULAR = ["WALK", "RUN", "CYCLE", "COFFEE", "DRINKS", "FOOD", "PAINT", "GYM"];

export type MeetupInitial = {
  id: string;
  title: string;
  category: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  findUs: string | null;
  startsAt: string;
  distanceKm: number | null;
  durationMins: number | null;
  pace: string | null;
  description: string | null;
  emoji: string | null;
  forWho: string;
};

type PlaceCheck =
  | { status: "idle" }
  | { status: "checking"; for: string }
  | { status: "found"; for: string; label: string; latitude: number; longitude: number }
  | { status: "not_found" | "unavailable"; for: string };

/** Where the pin goes: found from the place text it's for, or put on the
 * map by hand, which holds whatever the text says. */
type Pin = { lat: number; lng: number; for: string; byHand: boolean };

/** Roughly how far apart two spots are, near enough for under a few km. */
function kmApart(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const x = (b.lng - a.lng) * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return Math.hypot(x, b.lat - a.lat) * 111.32;
}

type Step = "what" | "where" | "when" | "name";
const STEPS: Step[] = ["what", "where", "when", "name"];

/** The part of a place's name that says where it is, for a suggested
 * meetup name: "1a, High Street, Clapham" is "High Street", not "1a". */
function placeWord(text: string): string {
  const parts = text.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.find((part) => !/^\d+[a-z]?([-/]\d+[a-z]?)?$/i.test(part)) ?? parts[0] ?? "";
}

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
export default function MeetupForm({
  initial,
  hostGender,
}: {
  initial?: MeetupInitial;
  // Male, female or T-Rex: which group they can keep it to.
  hostGender: string | null;
}) {
  const editing = Boolean(initial);
  const t = useT();
  const lang = useLocale();
  const [state, action, pending] = useActionState<MeetupFormState, FormData>(saveMeetupAction, {
    error: null,
  });
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [category, setCategory] = useState(initial?.category ?? "");
  // The everyday ones first; the rest behind "More ideas".
  const [place, setPlace] = useState<PlaceCheck>({ status: "idle" });
  // The place's name and the comment live here rather than in their boxes:
  // posting, the boxes sit on the full-screen map, outside the form, and
  // hidden inputs carry them. A ref too, for look-ups that finish later.
  const [placeText, setPlaceTextState] = useState(initial?.location ?? "");
  const placeRef = useRef(placeText);
  const setPlaceText = (text: string) => {
    placeRef.current = text;
    setPlaceTextState(text);
  };
  // Whether the name in the box is the one the map gave the pin rather
  // than the host's own: that one follows the pin when it moves, theirs
  // is never touched.
  const nameFromPin = useRef(false);
  const typePlace = (text: string) => {
    nameFromPin.current = false;
    setPlaceText(text);
  };
  // Counts the pin's moves, so only the latest spot's name lands.
  const naming = useRef(0);
  const [findUs, setFindUs] = useState(initial?.findUs ?? "");
  // Found from the place name, or marked on the map. Kept in a ref too,
  // for Next and the send, which run straight after a look-up that may
  // have just set it. A saved meetup's pin counts as marked.
  const startPin =
    initial?.latitude != null && initial.longitude != null
      ? { lat: initial.latitude, lng: initial.longitude, for: initial.location, byHand: true }
      : null;
  const [pin, setPinState] = useState<Pin | null>(startPin);
  const pinRef = useRef<Pin | null>(startPin);
  const setPin = (p: Pin | null) => {
    pinRef.current = p;
    setPinState(p);
  };
  // Goes up when a place is found from its name, to take the map there.
  const [focus, setFocus] = useState(0);
  const [when, setWhen] = useState<Date | null>(null);
  const [title, setTitle] = useState(initial?.title ?? "");
  // As typed: "7,5" is as good as "7.5" (see kmFrom).
  const [distance, setDistance] = useState(initial?.distanceKm != null ? String(initial.distanceKm) : "");
  // "Something else" has its own emoji, typed: the pin on the map. Until
  // the box holds just one emoji, the pin is the type's own 🎉.
  const [ownEmoji, setOwnEmoji] = useState(initial?.emoji ?? "");
  const emoji = oneEmoji(ownEmoji);
  const [titleTouched, setTitleTouched] = useState(editing);
  // An error is about the form as it was sent. Once they start fixing it,
  // it's out of date.
  const [edited, setEdited] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const lookingUp = useRef<{ text: string; result: Promise<PlaceCheck> } | null>(null);
  const onWhen = useCallback((d: Date | null) => setWhen(d), []);

  const saving = pending || place.status === "checking";
  // A distance, a time and a pace only mean something for a run, a ride
  // and the like; a painting meetup isn't asked for them.
  const route = categoryFor(category).route;
  const badDistance = route && distance.trim() !== "" && kmFrom(distance) == null;
  const steps = STEPS;
  const at = steps[step];
  const show = (s: Step) => editing || at === s;

  function locationText(): string {
    return placeRef.current.trim();
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
      const mine = pinRef.current?.byHand ? pinRef.current : null;
      if (found.status === "found") {
        // A pin marked by hand stays put while the name is tidied up (a
        // big park's name finds its middle, maybe a km or two away); a
        // place found somewhere else entirely moves it there.
        const at = { lat: found.latitude, lng: found.longitude };
        if (mine && (mine.for === text || kmApart(mine, at) < 3)) setPin({ ...mine, for: text });
        else {
          setPin({ ...at, for: text, byHand: false });
          setFocus((n) => n + 1);
        }
      } else if (found.status === "not_found" && !mine) {
        setPin(null);
      }
      if (lookingUp.current?.text === text) lookingUp.current = null;
      return next;
    });
    lookingUp.current = { text, result };
    return result;
  }

  /** A pin put on the map by hand. With no name for the place typed yet,
   * the name of the spot goes in the box to start from, and changes with
   * the pin each time it's moved, until the host writes their own. */
  function markByHand(lat: number, lng: number) {
    setPin({ lat, lng, for: locationText(), byHand: true });
    setStepError(null);
    setEdited(true);
    const ask = ++naming.current;
    if (locationText() && !nameFromPin.current) return;
    void placeName(lat, lng).then((name) => {
      // An answer for a spot the pin has since left, or a name the host
      // has typed in the meantime: leave the box alone.
      if (!name || ask !== naming.current) return;
      if (locationText() && !nameFromPin.current) return;
      nameFromPin.current = true;
      setPlaceText(name);
      // A "found" line would be about the old name.
      setPlace({ status: "idle" });
      // The name came from the pin, so looking it up never moves the pin.
      const now = pinRef.current;
      if (now?.byHand && now.lat === lat && now.lng === lng) setPin({ ...now, for: name });
    });
  }

  /** A suggested name from what they've picked, until they type their own. */
  function suggestTitle(placeLabel?: string) {
    // "Something else at the park" says nothing: that one's theirs to name.
    if (titleTouched || category === "SOCIAL") return;
    const kind = typeName(t, category).split(" / ")[0];
    const where = placeWord(placeLabel ?? locationText());
    setTitle(where ? fill(t.form.titleAt, { kind, place: where }) : kind);
  }

  async function next() {
    setStepError(null);
    if (at === "what") {
      if (!category) return setStepError(t.form.pickOne);
      // Their own, typed: it needs a name; the emoji can wait (🎉).
      if (category === "SOCIAL") {
        if (title.trim().length < 3) return setStepError(t.errors.giveName);
        if (ownEmoji.trim() && !emoji) return setStepError(t.form.oneEmoji);
      }
    }
    if (at === "where") {
      const text = locationText();
      if (text.length < 3) return setStepError(t.errors.typeWhere);
      const before = pinRef.current;
      const found = await lookUp(text);
      const now = pinRef.current;
      if (found.status === "not_found" && !now?.byHand) {
        return setStepError(fill(t.form.cantFindMark, { place: text }));
      }
      // The map has just gone to the place found: stay, so the pin can be
      // checked first.
      if (now && now !== before && !now.byHand) return;
      // A marked spot's name is whatever the host has in the box.
      suggestTitle(found.status === "found" && !now?.byHand ? found.label : undefined);
    }
    if (at === "when" && !when) return setStepError(t.errors.pickDayTime);
    if (at === "when" && badDistance) return setStepError(t.errors.checkDistance);
    setStep(step + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const placeStatus =
    place.status === "checking" ? (
      <span className="text-slate-600">{t.form.finding}</span>
    ) : place.status === "not_found" ? (
      <span className="font-medium text-amber-800">{t.form.cantFind}</span>
    ) : null;

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
        // The last step (a comment, the name) is optional: from When, Post
        // sends it as it is. Only with no name yet does it go there first.
        const canPost = editing || at === "name" || (at === "when" && title.trim().length >= 3);
        if (!canPost) return next();
        if (!when) return setStepError(t.errors.pickDayTime);
        if (badDistance) {
          // Back to the box it's in, if it's a step behind.
          if (!editing) setStep(steps.indexOf("when"));
          return setStepError(t.errors.checkDistance);
        }
        const text = locationText();
        // An edit that leaves the place alone keeps the pin it has.
        const found = initial && text === initial.location ? null : await lookUp(text);
        const data = new FormData(formRef.current!);
        // The pin as the host left it: marked by hand, or found for this place.
        const p = pinRef.current;
        const spot = p && (p.byHand || p.for === text) ? p : null;
        if (spot) {
          data.set("latitude", String(spot.lat));
          data.set("longitude", String(spot.lng));
          data.set("placeFor", text);
        } else if (found?.status === "found") {
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
      <input type="hidden" name="location" value={placeText} />
      <input type="hidden" name="findUs" value={findUs} />

      {!editing && (
        <div aria-live="polite">
          <p className="sr-only">{fill(t.form.step, { n: step + 1, total: steps.length })}</p>
          <div className="flex gap-1.5" aria-hidden="true">
            {steps.map((s, i) => (
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

      {/* 1. What: a button for the usual ones, which goes straight on, or
          their own typed in with an emoji for its pin. Editing, just the
          emoji, as the name is with the rest below. */}
      <fieldset hidden={!show("what")}>
        <legend className="mb-3 text-xl font-bold text-slate-900">{t.form.what}</legend>
        <div className="type-grid type-grid-fill">
          {/* In POPULAR's order; editing an older meetup of another type,
              its own is there too. */}
          {[...POPULAR, ...(editing && category !== "SOCIAL" && !POPULAR.includes(category) ? [category] : [])]
            .map((value) => categoryFor(value))
            .map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => {
                setCategory(c.value);
                setStepError(null);
                setEdited(true);
                // On the first step, picking one is the answer: straight on,
                // leaving behind anything half typed below.
                if (!editing) {
                  setTitle("");
                  setTitleTouched(false);
                  setOwnEmoji("");
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
              <span>{typeName(t, c.value)}</span>
            </button>
          ))}
        </div>
        {(!editing || category === "SOCIAL") && (
          <div className="mt-5">
            <p className="label !text-base">{editing ? t.form.emoji : t.form.orYourOwn}</p>
            <div className="flex gap-3">
              <input
                id="own-emoji"
                className="input !w-20 min-h-14 flex-none text-center !text-3xl placeholder:!text-sm"
                value={ownEmoji}
                placeholder={t.form.emojiShort}
                aria-label={t.form.emoji}
                maxLength={16}
                autoComplete="off"
                onChange={(e) => {
                  setOwnEmoji(e.target.value);
                  if (!editing) setCategory("SOCIAL");
                  setEdited(true);
                  setStepError(null);
                }}
              />
              {!editing && (
                <input
                  className="input min-h-14 flex-1 !text-lg"
                  id="kind"
                  value={category === "SOCIAL" ? title : ""}
                  placeholder={t.form.whatIsItHint}
                  aria-label={t.form.name}
                  enterKeyHint="next"
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setTitleTouched(true);
                    setCategory("SOCIAL");
                    setStepError(null);
                  }}
                  maxLength={120}
                />
              )}
            </div>
            {ownEmoji.trim() && !emoji && (
              <p className="mt-2 text-sm font-medium text-amber-800">{t.form.oneEmoji}</p>
            )}
          </div>
        )}
      </fieldset>
      <input type="hidden" name="emoji" value={category === "SOCIAL" ? (emoji ?? "") : ""} />

      {/* 3. Meeting point. Posting, it's the whole screen, a map like the
          main one (MeetingPointMap); editing, a map in the page. */}
      <fieldset hidden={!show("where")} className="space-y-4">
        {editing ? (
          <>
            <legend className="mb-1 text-xl font-bold text-slate-900">{t.form.meetingPoint}</legend>
            <div>
              <label className="label !text-base" htmlFor="location">
                {t.form.meetingPlace}
              </label>
              <p id="location-hint" className="text-sm text-slate-600 mb-2">
                {t.form.meetingPlaceHint}
              </p>
              <input
                className="input !text-base min-h-12"
                id="location"
                value={placeText}
                onChange={(e) => typePlace(e.target.value)}
                maxLength={200}
                autoComplete="off"
                aria-describedby="location-hint location-check"
                onBlur={(e) => void lookUp(e.target.value.trim())}
              />
              {/* A line's room kept for "Finding it…", and never more than a
                  line, so what appears here doesn't push Save down from
                  under a finger mid-tap. */}
              <p id="location-check" className="mt-2 min-h-6 truncate text-base" aria-live="polite">
                {placeStatus}
              </p>
              <div className="mt-2">
                <PinPicker spot={pin} focus={focus} onMark={markByHand} />
              </div>
            </div>
            <div>
              <label className="label !text-base" htmlFor="findUs">
                {t.form.spotYou} <span className="font-normal text-slate-600">{t.common.optional}</span>
              </label>
              <p id="findUs-hint" className="text-sm text-slate-600 mb-2">
                {t.form.spotYouHint}
              </p>
              <input
                className="input !text-base min-h-12"
                id="findUs"
                value={findUs}
                onChange={(e) => setFindUs(e.target.value)}
                maxLength={200}
                aria-describedby="findUs-hint"
              />
            </div>
          </>
        ) : (
          at === "where" && (
            <MeetingPointMap
              place={placeText}
              onPlace={(text) => {
                typePlace(text);
                setEdited(true);
              }}
              onFind={(text) => void lookUp(text)}
              status={placeStatus}
              error={stepError}
              spot={pin}
              focus={focus}
              onMark={markByHand}
              comment={findUs}
              onComment={(text) => {
                setFindUs(text);
                setEdited(true);
              }}
              onBack={back}
              onNext={() => void next()}
              nextLabel={place.status === "checking" ? t.form.finding : t.common.next}
              busy={place.status === "checking"}
            />
          )
        )}
      </fieldset>

      {/* 4. When */}
      <fieldset hidden={!show("when")}>
        <legend className="mb-3 text-xl font-bold text-slate-900">{t.form.when}</legend>
        <WhenPicker initialIso={initial?.startsAt} onChange={onWhen} />
        {/* All four shown; only all and the host's own group can be picked
            (and what it already has, editing). All unless they say. */}
        <fieldset className="mt-5">
          <legend className="label !text-base">{t.forWho.label}</legend>
          <PickOne
            name="forWho"
            defaultValue={initial?.forWho ?? "ALL"}
            options={FOR_WHO_PICKS.map((v) => ({ value: v, emoji: FOR_WHO_EMOJI[v], label: t.forWho[v] }))}
            off={FOR_WHO_PICKS.filter((v) => !forWhoChoices(hostGender).includes(v) && v !== initial?.forWho)}
          />
        </fieldset>
        {/* How far and how long: a walk, run, ride and the like. Neither
            has to be filled in. The time gets the wider half: "Not sure"
            and "1 h 30 min" are longer than any distance. */}
        {route && (
          <div className="mt-5 grid grid-cols-[minmax(0,4fr)_minmax(0,5fr)] gap-3">
            <div>
              <label className="label !text-base" htmlFor="distanceKm">
                {t.form.howFar}
                <span className="sr-only"> (km)</span>
              </label>
              <div className="relative">
                <input
                  className="input !text-base min-h-12 !pr-11"
                  id="distanceKm"
                  name="distanceKm"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={t.form.kmHint}
                  value={distance}
                  onChange={(e) => {
                    setDistance(e.target.value);
                    setStepError(null);
                  }}
                  maxLength={8}
                  aria-invalid={badDistance || undefined}
                />
                <span
                  className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-base text-slate-600"
                  aria-hidden="true"
                >
                  km
                </span>
              </div>
            </div>
            <div>
              <label className="label !text-base" htmlFor="durationMins">
                {t.form.howLong}
              </label>
              <select
                className="input !text-base min-h-12"
                id="durationMins"
                name="durationMins"
                defaultValue={initial?.durationMins ?? ""}
              >
                <option value="">{t.form.notSure}</option>
                {DURATIONS.map((m) => (
                  <option key={m} value={m}>
                    {howLong(t, m, lang)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </fieldset>

      {/* 5. Name and extras */}
      <fieldset hidden={!show("name")} className="space-y-4">
        <legend className="mb-1 text-xl font-bold text-slate-900">
          {editing ? t.form.name : t.form.nameIt}
        </legend>
        <div>
          <label className="sr-only" htmlFor="title">
            {t.form.meetupName}
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
        </div>

        <div>
          <label className="label !text-base" htmlFor="description">
            {t.form.comment} <span className="font-normal text-slate-600">{t.common.optional}</span>
          </label>
          <textarea
            className="input !text-base"
            id="description"
            name="description"
            rows={3}
            maxLength={2000}
            placeholder={commentHint(t, category)}
            defaultValue={initial?.description ?? ""}
          />
        </div>
        {/* Only for a walk, run, ride and the like. */}
        {route && (
          <div>
            <label className="label !text-base" htmlFor="pace">
              {t.form.pace} <span className="font-normal text-slate-600">{t.common.optional}</span>
            </label>
            <input
              className="input !text-base min-h-12"
              id="pace"
              name="pace"
              placeholder={t.form.paceHint}
              defaultValue={initial?.pace ?? ""}
              maxLength={40}
            />
          </div>
        )}
      </fieldset>

      <div className="flex gap-3">
        {!editing && step > 0 && (
          <button type="button" onClick={back} className="btn-secondary min-h-12 px-5 text-base">
            {t.common.back}
          </button>
        )}
        {/* Step 1 moves on when a type is tapped; Next only for one typed. */}
        {(editing || step > 0 || category === "SOCIAL") && (
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
                ? t.meetup.saving
                : t.form.saveChanges
              : at !== "when" && at !== "name"
                ? place.status === "checking"
                  ? t.form.finding
                  : t.common.next
                : saving
                  ? t.form.posting
                  : `${t.form.postMeetup} 🎉`}
          </button>
        )}
      </div>
      {/* The last step is there for whoever wants it. */}
      {!editing && at === "when" && (
        <button
          type="button"
          onClick={() => void next()}
          className="btn-secondary -mt-2 min-h-12 w-full text-base"
        >
          + {t.form.addComment}
        </button>
      )}
    </form>
  );
}
