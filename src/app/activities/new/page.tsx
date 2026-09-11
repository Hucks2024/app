import { requireMember } from "@/lib/auth";
import { CATEGORIES } from "@/lib/categories";
import { createActivityAction } from "@/app/activities/actions";

export default async function NewActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireMember();
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-bold mb-1 text-white drop-shadow">Post a meetup</h1>
      <p className="text-sm text-white/85 mb-6">
        Four questions and you&apos;re done. A run, a walk, or just coffee, they all count. Every
        pace welcome, walking breaks included.
      </p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 dark:bg-red-950 dark:border-red-800 dark:text-red-300">
          {error}
        </p>
      )}

      {/* Only three fields are actually required, so only three are shown.
          Everything else the form supports (distance, pace, cap, notes,
          Strava link) lives behind the expander below, folded away by
          default, an empty value for any of them is perfectly valid. */}
      <form action={createActivityAction} className="card space-y-5">
        <div>
          <label className="label" htmlFor="category">
            1. What kind of meetup?
          </label>
          <select className="input" id="category" name="category" defaultValue="RUN">
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
            required
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
            placeholder="Riverside Park, main entrance"
            required
          />
          <p className="text-xs text-slate-500 mt-1">
            A landmark is plenty, we&apos;ll put it on the map for you.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="startsAt">
            4. When?
          </label>
          <input className="input" id="startsAt" name="startsAt" type="datetime-local" required />
        </div>

        <details className="border-t border-slate-200 pt-4">
          <summary className="cursor-pointer select-none text-sm font-medium text-brand-700 dark:text-brand-400">
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
                  placeholder="10"
                />
              </div>
              <div>
                <label className="label" htmlFor="pace">
                  Pace
                </label>
                <input className="input" id="pace" name="pace" placeholder="6:00 / km" />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Distance and pace only matter if you&apos;re moving, skip them for a coffee. No idea
              on pace? Leave it blank, or write what it feels like. Every pace is a real pace.
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
                placeholder="Leave blank for no limit"
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
                placeholder="Route, what to bring, coffee after…"
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
              />
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                ⚠️ Set the route to <strong>Public</strong> in Strava, a private link won&apos;t
                open for anyone else.
              </p>
            </div>
          </div>
        </details>

        <button type="submit" className="btn-primary w-full">
          Post meetup
        </button>
      </form>
    </div>
  );
}
