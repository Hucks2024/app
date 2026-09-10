import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isPaidUp } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { SITE } from "@/lib/site";
import RunsScreen from "@/components/RunsScreen";
import ActivitiesMap, { type MapActivity } from "@/components/ActivitiesMap";

// Anonymous visitors get a real map (so there's something to see, and a
// reason to sign up) but not real precision: jitter each pin by up to
// roughly 1-2km so the preview can't be used to find an exact meeting
// point without an account. This runs fresh per request, not stored.
function jitter(value: number) {
  return value + (Math.random() - 0.5) * 0.02;
}

export default async function HomePage() {
  const user = await getCurrentUser();

  // Logged-in members see the map right here on "/", no marketing copy,
  // no extra click. Same funnel as everywhere else: pay, then verify.
  if (user) {
    if (!isPaidUp(user)) redirect("/subscribe");
    if (user.verificationStatus !== "APPROVED") redirect("/verify");
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
      joinedCount: 0,
      maxParticipants: a.maxParticipants,
    }));

  return (
    <div>
      <section>
        <div className="mx-auto max-w-xl px-4 pt-12 pb-6 text-center">
          <p className="badge-green mb-3">Photo-ID verified members only</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white drop-shadow">
            <span aria-hidden>🏃‍♀️</span> Connect with Running
          </h1>
          <p className="text-sm text-white/85 mt-3 max-w-sm mx-auto">
            Real humans only, built for real runs. Pins are approximate until you{" "}
            <Link href="/login" className="underline font-medium text-white">
              log in
            </Link>{" "}
            to see exact times, meeting points, and join.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 pb-10">
        <ActivitiesMap activities={previewActivities} restricted />
      </div>
    </div>
  );
}
