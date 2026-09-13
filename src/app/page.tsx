import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isPaidUp, needsEmailCheck } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { SITE } from "@/lib/site";
import RunsScreen from "@/components/RunsScreen";
import MapPanel from "@/components/MapPanel";
import Logo from "@/components/Logo";
import type { MapActivity } from "@/components/ActivitiesMap";

// Anonymous visitors get a real map (so there's something to see, and a
// reason to sign up) but not real precision: jitter each pin by up to
// roughly 1-2km so the preview can't be used to find an exact meeting
// point without an account. This runs fresh per request, not stored.
function jitter(value: number) {
  return value + (Math.random() - 0.5) * 0.02;
}

export default async function HomePage() {
  const user = await getCurrentUser();

  // Logged-in members see the map right here on "/", no marketing copy, no
  // extra click. Nothing stands between signing up and the app now except
  // the membership fee, and that's switched off while it's free.
  if (user) {
    if (needsEmailCheck(user)) redirect("/verify-email");
    if (!isPaidUp(user)) redirect("/subscribe");
    return <RunsScreen />;
  }

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
            {SITE.name}
          </h1>
          {/* The name is the headline and the sentence explains it, so the
              sentence drops the "Packmates is" opening it carries in the
              meta description, where it has to stand on its own. */}
          <p className="text-sm text-white/85 mt-4 max-w-md mx-auto">
            A private, members-only community for people all over the world to train, travel and
            meet up. Access is by referral.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 pb-10">
        <MapPanel activities={previewActivities} restricted />
        <p className="text-xs text-white/75 text-center mt-3">
          Pins are approximate.{" "}
          <Link href="/login" className="underline font-medium text-white">
            Log in
          </Link>{" "}
          for exact times and meeting points, and to join.
        </p>
      </div>
    </div>
  );
}
