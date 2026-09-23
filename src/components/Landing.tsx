import Link from "next/link";
import { getPrisma } from "@/lib/db";
import MeetupBoard from "@/components/MeetupBoard";
import type { MapActivity } from "@/components/ActivitiesMap";

// Anonymous visitors get a real map (so there's something to see, and a
// reason to sign up) but not real precision: jitter each pin by up to
// roughly 1-2km so the preview can't be used to find an exact meeting
// point without an account. This runs fresh per request, not stored.
function jitter(value: number) {
  return value + (Math.random() - 0.5) * 0.02;
}

/** The front door: what this is, and a blurred look at the map. */
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
  // The id is synthetic for the same reason. React needs a stable key and
  // the pin animation needs something to derive its rhythm from, and
  // neither needs to be the real row id.
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
    }));

  return (
    <div>
      {/* Straight to the map. Nothing above it: a visitor who has been
          sent here by a member already knows what this is, and a hero
          only delays the one thing that shows them it's real. */}
      <div className="mx-auto max-w-3xl px-4 pt-2 pb-10">
        <MeetupBoard activities={previewActivities} restricted />
        <p className="text-xs text-white/75 text-center mt-3">
          Pins are approximate. Tap one to see what it is.{" "}
          <Link href="/login" className="underline font-medium text-white">
            Log in
          </Link>{" "}
          for exact times, meeting points, and who&apos;s going.
        </p>
      </div>
    </div>
  );
}
