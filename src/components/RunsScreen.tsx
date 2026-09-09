import Link from "next/link";
import type { User } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import ActivitiesMap from "@/components/ActivitiesMap";

// The map of upcoming runs — the thing a logged-in member should see
// immediately, whether they land on "/" or navigate to "/activities".
// Both pages just render this with the already-resolved user.
export default async function RunsScreen({ user }: { user: User }) {
  const prisma = await getPrisma();

  const activities = await prisma.runActivity.findMany({
    where: { startsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
    include: {
      participations: { where: { status: "JOINED" } },
    },
  });

  const isVerified = user.verificationStatus === "APPROVED";

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
      joinedCount: a.participations.length,
      maxParticipants: a.maxParticipants,
    }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Upcoming runs</h1>
        {isVerified && (
          <Link href="/activities/new" className="btn-primary">
            + Post a run
          </Link>
        )}
      </div>

      {!isVerified && (
        <div className="card bg-amber-50 border-amber-200 mb-6">
          <p className="text-sm text-amber-800">
            You can browse runs, but you&apos;ll need to{" "}
            <Link href="/verify" className="underline font-medium">
              get verified
            </Link>{" "}
            before you can join one or post your own.
          </p>
        </div>
      )}

      <ActivitiesMap activities={mapActivities} />
    </div>
  );
}
