import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { refreshVerified } from "@/lib/trust";
import { CATEGORIES } from "@/lib/categories";
import { createActivityAction } from "@/app/activities/actions";
import LocalTime from "@/components/LocalTime";
import SubmitButton from "@/components/SubmitButton";
import WhenInput from "@/components/WhenInput";

export const metadata = { title: "Post a meetup" };

export default async function NewActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireMember();
  const { error } = await searchParams;
  const prisma = await getPrisma();

  // Not unlocked yet: say how, and if they're already going to something,
  // say that's the one that'll do it.
  if (!(await refreshVerified(prisma, user)).verified) {
    const next = await prisma.participation.findFirst({
      where: { userId: user.id, status: "JOINED", activity: { startsAt: { gt: new Date() } } },
      orderBy: { activity: { startsAt: "asc" } },
      select: { activity: { select: { id: true, title: true, startsAt: true } } },
    });
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="card text-center">
          <p className="text-4xl" aria-hidden="true">
            🔓
          </p>
          <h1 className="mt-2 text-xl font-bold">Post your own after your first meetup</h1>
          <p className="mt-2 text-sm text-slate-600">
            Everyone who hosts on packmates has been to a meetup first. It&apos;s how we keep it
            friendly without invites: every host has turned up and met people.
          </p>
          {next ? (
            <p className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
              You&apos;re going to{" "}
              <Link href={`/activities/${next.activity.id}`} className="font-semibold underline">
                {next.activity.title}
              </Link>{" "}
              (<LocalTime iso={next.activity.startsAt.toISOString()} style="short" />). Once
              it&apos;s happened, the + is yours.
            </p>
          ) : (
            <ol className="mt-4 space-y-1 text-left text-sm text-slate-700 inline-block">
              <li>1. Pick a meetup on the map</li>
              <li>2. Tap <strong>I&apos;m in</strong> and go along</li>
              <li>3. That&apos;s it: you can post your own from then on</li>
            </ol>
          )}
          <div className="mt-6">
            <Link href="/" className="btn-primary">
              Find a meetup
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-bold mb-1 text-white drop-shadow">Post a meetup</h1>
      <p className="text-sm text-white/85 mb-6">
        Four questions and you&apos;re done. A run, a trek, a travel day, or just coffee, they all
        count. Everyone welcome, whatever shape you&apos;re in.
      </p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
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
          <WhenInput />
        </div>

        <details className="border-t border-slate-200 pt-4">
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
              <p className="text-xs text-amber-700 mt-1">
                ⚠️ Set the route to <strong>Public</strong> in Strava, a private link won&apos;t
                open for anyone else.
              </p>
            </div>
          </div>
        </details>

        <SubmitButton className="btn-primary w-full !py-3" pending="Putting it on the map…">
          Post meetup
        </SubmitButton>
      </form>
    </div>
  );
}
