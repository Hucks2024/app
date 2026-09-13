import Link from "next/link";
import type { User } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { clubFor } from "@/lib/clubs";
import MapPanel from "@/components/MapPanel";

// The map of upcoming meetups in the member's own club. Only reachable by
// members, both "/" and "/activities" gate on requireMember() before
// rendering this, so there's no "you're not a member yet" branch to handle
// here.
export default async function RunsScreen({ user }: { user: User }) {
  const prisma = await getPrisma();
  const club = clubFor(user.club);

  const activities = await prisma.runActivity.findMany({
    // Scoped to the member's club. The two clubs are separate memberships,
    // so a Pacemate never sees a Packmates meetup and vice versa.
    where: { club: club.key, startsAt: { gte: new Date() } },
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
      category: a.category,
      afterSpot: a.afterSpot,
      joinedCount: a.participations.length,
      maxParticipants: a.maxParticipants,
    }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white drop-shadow">Upcoming {club.noun.many}</h1>
        <Link href="/activities/new" className="btn-primary">
          + Post a {club.noun.one}
        </Link>
      </div>

      <MapPanel activities={mapActivities} />
    </div>
  );
}
