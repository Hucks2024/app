import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { SITE } from "@/lib/site";
import RunsScreen from "@/components/RunsScreen";
import ActivitiesMap, { type MapActivity } from "@/components/ActivitiesMap";

// Anonymous visitors get a real map (so there's something to see, and a
// reason to sign up) but not real precision — jitter each pin by up to
// roughly 1-2km so the preview can't be used to find an exact meeting
// point without an account. This runs fresh per request, not stored.
function jitter(value: number) {
  return value + (Math.random() - 0.5) * 0.02;
}

export default async function HomePage() {
  const user = await getCurrentUser();

  // Logged-in members see the map right here on "/" — no marketing copy,
  // no extra click. Not-yet-verified members still go to /verify first,
  // same as the login form's own redirect.
  if (user) {
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
      joinedCount: 0,
      maxParticipants: a.maxParticipants,
    }));

  return (
    <div>
      <section className="mx-auto max-w-xl px-4 pt-10 pb-4 text-center">
        <p className="badge-green mb-2">Photo-ID verified members only</p>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
          Connect with Running
        </h1>
      </section>

      <div className="relative mx-auto max-w-3xl px-4 pb-10">
        <div className="blur-sm pointer-events-none select-none">
          <ActivitiesMap activities={previewActivities} />
        </div>
        <div className="absolute inset-4 flex items-center justify-center">
          <div className="card bg-white/95 shadow-lg text-center max-w-xs">
            <p className="text-2xl mb-2" aria-hidden>
              🔒
            </p>
            <p className="font-semibold mb-1">See who&apos;s running near you</p>
            <p className="text-sm text-slate-600 mb-4">
              Log in to see exact times, locations, and join a run.
            </p>
            <div className="flex flex-col gap-2">
              <Link href="/signup" className="btn-primary">
                Join {SITE.name}
              </Link>
              <Link href="/login" className="btn-secondary">
                Log in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
