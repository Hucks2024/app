import type { User } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { clubFor } from "@/lib/clubs";
import MeetupBoard from "@/components/MeetupBoard";

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
      // The people, not just the count: the pins show a face, which is
      // what makes a meetup read as somebody going rather than a category
      // sitting on a map.
      participations: {
        where: { status: "JOINED" },
        include: { user: { select: { id: true, profilePhoto: true } } },
        orderBy: { joinedAt: "asc" },
      },
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
      faces: a.participations.slice(0, 3).map((p) => ({
        userId: p.user.id,
        hasPhoto: p.user.profilePhoto != null,
      })),
    }));

  return (
    // No heading row. The chips below already say what you're looking at,
    // and on a phone that row was costing the map about 90px to tell
    // members something they knew. Posting moved to the floating button,
    // where it's bigger and always within thumb reach.
    <div className="mx-auto max-w-3xl px-4 pt-2 pb-2">
      <MeetupBoard
        activities={mapActivities}
        post={{ href: "/activities/new", label: `Post a ${club.noun.one}` }}
      />
    </div>
  );
}
