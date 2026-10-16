import { getPrisma } from "@/lib/db";
import { liveMeetup } from "@/lib/meetups";
import MeetupBoard from "@/components/MeetupBoard";
import Welcome from "@/components/Welcome";
import type { MapActivity } from "@/components/ActivitiesMap";
import { getT } from "@/i18n/server";
import LanguagePicker from "@/components/LanguagePicker";

// Anonymous visitors get a real map (so there's something to see, and a
// reason to sign up) but not real precision: jitter each pin by up to
// roughly 1-2km so the preview can't be used to find an exact meeting
// point without an account. This runs fresh per request, not stored.
function jitter(value: number) {
  return value + (Math.random() - 0.5) * 0.02;
}

// How it works, in three words each.
const STEPS = [
  { emoji: "📍", text: "find" },
  { emoji: "🙌", text: "tap" },
  { emoji: "🤘", text: "turnUp" },
] as const;

/** The front door: hello and the way in, how it works in three words each,
 * and a blurred look at what's on. */
export default async function Landing() {
  const [prisma, t] = await Promise.all([getPrisma(), getT()]);
  const activities = await prisma.runActivity.findMany({
    where: { startsAt: { gte: new Date() }, ...liveMeetup },
    orderBy: { startsAt: "asc" },
    select: { latitude: true, longitude: true, category: true },
  });

  // Only what a public pin needs to exist: a rough position and a
  // category. Everything else is left behind on the server.
  //
  // This is what actually makes the details members-only. A client
  // component's props are serialised into the page, so sending the real
  // titles and times and merely declining to render them would put all of
  // it one View Source away. The popup can't leak what was never sent.
  //
  // The id is synthetic for the same reason. React needs a stable key,
  // and that doesn't need to be the real row id.
  const previewActivities: MapActivity[] = activities
    .filter((a) => a.latitude != null && a.longitude != null)
    .map((a, i) => ({
      id: `preview-${i}`,
      title: "",
      location: "",
      startsAt: "",
      latitude: jitter(a.latitude as number),
      longitude: jitter(a.longitude as number),
      distanceKm: null,
      pace: null,
      category: a.category,
      afterSpot: null,
      // Who's going is members-only. The logged-out map shows that
      // meetups exist, never who or how many are at them.
      joinedCount: 0,
      maxParticipants: null,
      host: null,
    }));

  return (
    <div>
      {/* The same meetups, so the number up top and the pins below agree. */}
      <Welcome count={activities.length} />

      <section className="mx-auto max-w-3xl px-4 pb-4" aria-labelledby="how-heading">
        <h2 id="how-heading" className="sr-only">
          {t.landing.how}
        </h2>
        <ol className="card !p-4 grid grid-cols-3 gap-2 text-center">
          {STEPS.map((s) => (
            <li key={s.text} className="flex flex-col items-center gap-1">
              <span className="text-3xl leading-none" aria-hidden="true">
                {s.emoji}
              </span>
              <span className="text-base font-semibold leading-tight text-slate-900">{t.landing[s.text]}</span>
            </li>
          ))}
        </ol>
        {/* The house rule, said up front: it's part of what this place is,
            and the people it's meant to put off should read it first. */}
        <p className="mt-3 text-center text-sm font-medium text-white">
          🚩 {t.landing.reports}
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-4 pt-4 pb-10" aria-labelledby="map-heading">
        <h2
          id="map-heading"
          className="font-wordmark mb-2 text-center text-lg font-bold text-white lowercase"
        >
          {t.landing.nearYou}
        </h2>
        <MeetupBoard activities={previewActivities} restricted stage="preview" />
      </section>

      <div className="px-4 pb-10">
        <LanguagePicker onDark />
      </div>
    </div>
  );
}
