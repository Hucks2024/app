import Link from "next/link";
import { getPrisma } from "@/lib/db";
import { DEFAULT_INVITES } from "@/lib/invite";
import type { Club } from "@/lib/clubs";
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

/** One club's front door: what it is, and a blurred look at its map. */
export default async function ClubLanding({ club }: { club: Club }) {
  const prisma = await getPrisma();
  const activities = await prisma.runActivity.findMany({
    // Only this club's meetups. The two maps never bleed into each other,
    // which is the whole point of them being separate clubs.
    where: { club: club.key, startsAt: { gte: new Date() } },
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
      <section>
        <div className="mx-auto max-w-xl px-4 pt-6 pb-6 text-center">
          <div className="flex justify-center mb-4">
            {/* Sized by height in classes so it scales up on wider screens;
                the size prop is the no-CSS fallback. */}
            <Logo size={112} variant="white" className="h-24 sm:h-28 w-auto" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white drop-shadow">
            {club.name}
          </h1>
          <p className="text-sm text-white/85 mt-4 max-w-md mx-auto">
            A highly exclusive club for {club.purpose.toLowerCase()}. {club.blurb} Membership is by
            referral only.
          </p>
          {/* The allowance comes from the constant the invite system
              actually spends, so the number on the front page can't drift
              away from the number members really get. */}
          <p className="text-xs text-white/70 mt-3 max-w-md mx-auto">
            Every member is invited by someone already here, and their name stays attached to yours.{" "}
            {DEFAULT_INVITES} invitations each. No private messages, no browsing people, no inbox
            to be pestered through.
          </p>
          <p className="text-xs font-semibold text-white/90 mt-3">Free while we&apos;re small 🎉</p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link href="/signup" className="btn-primary">
              I have a code
            </Link>
            <Link href={`/login?club=${club.slug}`} className="btn-secondary">
              Log in
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 pb-10">
        <MeetupBoard activities={previewActivities} restricted />
        <p className="text-xs text-white/75 text-center mt-3">
          Pins are approximate.{" "}
          <Link href={`/login?club=${club.slug}`} className="underline font-medium text-white">
            Log in
          </Link>{" "}
          for exact times and meeting points, and to join.
        </p>
      </div>
    </div>
  );
}
