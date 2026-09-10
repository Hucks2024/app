import { requireActiveMember } from "@/lib/auth";
import { createActivityAction } from "@/app/activities/actions";

export default async function NewActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireActiveMember();
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-bold mb-6 text-white drop-shadow">Post a run</h1>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 dark:bg-red-950 dark:border-red-800 dark:text-red-300">
          {error}
        </p>
      )}

      <form action={createActivityAction} className="card space-y-4">
        <div>
          <label className="label" htmlFor="title">
            Title
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
            Meeting point
          </label>
          <input
            className="input"
            id="location"
            name="location"
            placeholder="e.g. Riverside Park, main entrance"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="startsAt">
            Date &amp; time
          </label>
          <input className="input" id="startsAt" name="startsAt" type="datetime-local" required />
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
            <input className="input" id="pace" name="pace" placeholder="e.g. 5:30 / km" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="maxParticipants">
            Max participants (optional)
          </label>
          <input
            className="input"
            id="maxParticipants"
            name="maxParticipants"
            type="number"
            min="1"
          />
        </div>
        <div>
          <label className="label" htmlFor="description">
            Details
          </label>
          <textarea
            className="input"
            id="description"
            name="description"
            rows={4}
            placeholder="Anything runners should know: route, difficulty, what to bring…"
          />
        </div>
        <div>
          <label className="label" htmlFor="stravaUrl">
            Strava route (optional)
          </label>
          <input
            className="input"
            id="stravaUrl"
            name="stravaUrl"
            type="url"
            placeholder="https://www.strava.com/routes/..."
          />
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
            ⚠️ Make sure this route&apos;s privacy is set to <strong>Public</strong> in Strava,
            a private route link won&apos;t open for other members.
          </p>
        </div>
        <button type="submit" className="btn-primary w-full">
          Post run
        </button>
      </form>
    </div>
  );
}
