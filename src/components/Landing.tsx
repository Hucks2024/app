import { getPrisma } from "@/lib/db";
import MeetupBoard from "@/components/MeetupBoard";
import Welcome from "@/components/Welcome";
import type { MapActivity } from "@/components/ActivitiesMap";

// Anonymous visitors get a real map (so there's something to see, and a
// reason to sign up) but not real precision: jitter each pin by up to
// roughly 1-2km so the preview can't be used to find an exact meeting
// point without an account. This runs fresh per request, not stored.
function jitter(value: number) {
  return value + (Math.random() - 0.5) * 0.02;
}

const STEPS = [
  {
    emoji: "📍",
    title: "Find a meetup",
    body: "Runs, walks, coffee, a pint. Everything on is a pin on the map.",
  },
  {
    emoji: "🙌",
    title: "Tap “I'm in” and turn up",
    body: "That's it. No messages, no swiping, no browsing people.",
  },
  {
    emoji: "👍",
    title: "Thumbs up the people you met",
    body: "Everyone has a count. After your first meetup you can post your own.",
  },
];

/** The front door: hello and the way in, how it works in three lines, and
 * a blurred look at what's on. */
export default async function Landing() {
  const prisma = await getPrisma();
  const activities = await prisma.runActivity.findMany({
    where: { startsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
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
      joinedCount: 0,
      // Who's going is members-only, and a face is a person. The
      // logged-out map shows that meetups exist, never who is at them.
      faces: [],
      maxParticipants: null,
      host: null,
    }));

  return (
    <div>
      <Welcome />

      <section className="mx-auto max-w-3xl px-4 pb-4" aria-labelledby="how-heading">
        <h2 id="how-heading" className="sr-only">
          How it works
        </h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card !p-4 flex items-start gap-3 sm:flex-col sm:gap-2">
              <span className="step-badge" aria-hidden="true">
                {s.emoji}
              </span>
              <div>
                <p className="font-semibold text-slate-900">
                  <span className="text-brand-600">{i + 1}.</span> {s.title}
                </p>
                <p className="text-sm text-slate-600 mt-0.5">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-3xl px-4 pt-4 pb-10" aria-labelledby="map-heading">
        <h2
          id="map-heading"
          className="font-wordmark mb-2 text-center text-lg font-bold text-white lowercase"
        >
          what&apos;s on near you
        </h2>
        <MeetupBoard activities={previewActivities} restricted stage="preview" />
        <p className="text-xs text-white/75 text-center mt-3">
          Pins are approximate until you sign in. Tap one to see what it is.
        </p>
      </section>
    </div>
  );
}
