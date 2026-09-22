import Link from "next/link";
import { getPrisma } from "@/lib/db";
import { SITE } from "@/lib/site";
import MeetupBoard from "@/components/MeetupBoard";
import Logo from "@/components/Logo";
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

  const previewActivities: MapActivity[] = activities
    .filter((a) => a.latitude != null && a.longitude != null)
    .map((a) => ({
      id: a.id,
      title: a.title,
      location: a.location,
      startsAt: a.startsAt.toISOString(),
      latitude: jitter(a.latitude as number),
      longitude: jitter(a.longitude as number),
      distanceKm: a.distanceKm,
      pace: a.pace,
      category: a.category,
      afterSpot: a.afterSpot,
      joinedCount: 0,
      // Deliberately empty out here: who's going is members-only, and a
      // face is a person. The logged-out map shows meetups, never people.
      faces: [],
      maxParticipants: a.maxParticipants,
    }));

  return (
    <div>
      {/* Short on purpose. Everything above the map is what somebody has
          to read before they get to the thing that actually sells this,
          which is other people's meetups on a map, so the pitch is one
          line and the detail moved below. */}
      <section>
        <div className="mx-auto max-w-xl px-4 pt-5 pb-4 text-center">
          <div className="flex justify-center mb-3">
            <Logo size={80} variant="white" className="h-16 sm:h-20 w-auto" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white drop-shadow">
            {SITE.name}
          </h1>
          <p className="text-sm text-white/85 mt-3 max-w-md mx-auto">
            A private club for people all over the world to train, travel and meet up. Members
            only, by referral, and free while we&apos;re small.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Link href="/signup" className="btn-primary">
              I have a code
            </Link>
            <Link href="/login" className="btn-secondary">
              Log in
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 pb-10">
        <MeetupBoard activities={previewActivities} restricted stage="preview" />
        <p className="text-xs text-white/75 text-center mt-3">
          Pins are approximate.{" "}
          <Link href="/login" className="underline font-medium text-white">
            Log in
          </Link>{" "}
          for exact times and meeting points, and to join.
        </p>

        {/* The detail that used to sit between the name and the map. It
            answers the questions somebody asks after they're interested,
            so it waits until after the map has made them interested. */}
        <div className="card mt-6 text-sm text-slate-600 space-y-2">
          <p>
            <strong className="text-slate-900">Free while we&apos;re small.</strong> No card, no
            trial, nothing to cancel.
          </p>
          <p>
            <strong className="text-slate-900">Referral only.</strong> No code? Ask whoever told
            you about us.
          </p>
          <p>
            <strong className="text-slate-900">Nobody can message you on your own.</strong> Chat
            happens on a meetup, where everyone going can see it. There&apos;s no inbox and no way
            to browse people.
          </p>
        </div>
      </div>
    </div>
  );
}
