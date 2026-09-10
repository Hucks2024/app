import Link from "next/link";
import { getPrisma } from "@/lib/db";
import ActivitiesMap from "@/components/ActivitiesMap";

// The map of upcoming runs. Only reachable by verified members, both "/"
// and "/activities" gate on requireActiveMember() before rendering this,
// so there's no "you're not verified yet" branch to handle here.
export default async function RunsScreen() {
  const prisma = await getPrisma();

  const activities = await prisma.runActivity.findMany({
    where: { startsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
    include: {
      participations: { where: { status: "JOINED" } },
    },
  });

  const mapActivities = activities
    .filter((a) => a.latitude != null && a.longitude != null)
    .map((a) => ({
      id: a.id,
      title: a.title,
      location: a.location,
      startsAt: a.startsAt.toISOString(),
      latitude: a.latitude as number,
      longitude: a.longitude as number,
      distanceKm: a.distanceKm,
      pace: a.pace,
      joinedCount: a.participations.length,
      maxParticipants: a.maxParticipants,
    }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white drop-shadow">Upcoming runs</h1>
        <Link href="/activities/new" className="btn-primary">
          + Post a run
        </Link>
      </div>

      <ActivitiesMap activities={mapActivities} />
    </div>
  );
}
