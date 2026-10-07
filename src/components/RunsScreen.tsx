import { subDays } from "date-fns";
import type { CurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { refreshVerified, thumbsFor } from "@/lib/trust";
import { liveMeetup } from "@/lib/meetups";
import MeetupBoard from "@/components/MeetupBoard";
import MapNotice from "@/components/MapNotice";

// The map of upcoming meetups. Only reachable by members, both "/" and
// "/activities" gate on requireMember() before rendering this, so there's
// no "you're not a member yet" branch to handle here.
export default async function RunsScreen({ user }: { user: CurrentUser }) {
  const prisma = await getPrisma();
  const { verified, justVerified } = await refreshVerified(prisma, user);

  const activities = await prisma.runActivity.findMany({
    where: { startsAt: { gte: new Date() }, ...liveMeetup },
    orderBy: { startsAt: "asc" },
    include: {
      host: { select: { id: true, name: true } },
      // The people, not just the count: the pins show a face, which is
      // what makes a meetup read as somebody going rather than a category
      // sitting on a map.
      participations: {
        where: { status: "JOINED" },
        // The type, not the photo: it says whether there is one without
        // pulling every picture on the map out of the database.
        include: { user: { select: { id: true, profilePhotoType: true } } },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  // The host's 👍 is the trust signal at the point of choosing: it's what
  // somebody new looks at before saying they'll turn up.
  const thumbs = await thumbsFor(
    prisma,
    activities.map((a) => a.hostId)
  );

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
      // Only people with a photo: the pin shows a real face or none.
      faces: a.participations
        .filter((p) => p.user.profilePhotoType != null)
        .slice(0, 3)
        .map((p) => ({ userId: p.user.id, hasPhoto: true })),
      host: { name: a.host.name, thumbs: thumbs.get(a.host.id) ?? 0 },
    }));

  return (
    // No heading row. The chips below already say what you're looking at,
    // and on a phone that row was costing the map about 90px to tell
    // members something they knew. Posting moved to the floating button,
    // where it's bigger and always within thumb reach.
    <div className="mx-auto max-w-3xl px-4 pt-3 pb-8">
      <h1 className="sr-only">Meetups near you</h1>
      <MeetupBoard
        activities={mapActivities}
        post={{ href: "/activities/new", label: verified ? "Post a meetup" : "How to post a meetup" }}
        canPost={verified}
        notice={await noticeFor(user, verified, justVerified)}
      />
    </div>
  );
}

/** The one thing worth saying to this member on the map right now, most
 * important first, or nothing. */
async function noticeFor(user: CurrentUser, verified: boolean, justVerified: boolean) {
  if (justVerified) {
    return (
      <MapNotice id="verified">
        <strong className="text-slate-900">🎉 You can post now</strong>
        <br />
        Tap <strong>Post</strong> below.
      </MapNotice>
    );
  }

  // A meetup from the last week that's had people at it, where this
  // member hasn't given anyone a thumbs up yet.
  const prisma = await getPrisma();
  const now = new Date();
  const recent = await prisma.participation.findFirst({
    where: {
      userId: user.id,
      status: "JOINED",
      activity: {
        startsAt: { gte: subDays(now, 7), lte: now },
        cancelledAt: null,
        thumbsUps: { none: { fromId: user.id } },
      },
    },
    orderBy: { activity: { startsAt: "desc" } },
    select: {
      activity: {
        select: {
          id: true,
          title: true,
          _count: { select: { participations: { where: { status: "JOINED" } } } },
        },
      },
    },
  });
  if (recent && recent.activity._count.participations > 1) {
    return (
      <MapNotice
        id={`thumbs-${recent.activity.id}`}
        href={`/activities/${recent.activity.id}#people`}
        cta="Give thumbs up"
      >
        <strong className="text-slate-900">How was {recent.activity.title}? 👍</strong>
        <br />
        Thank the people you met.
      </MapNotice>
    );
  }

  if (!verified) {
    return (
      <MapNotice id="welcome">
        <strong className="text-slate-900">👋 Welcome</strong>
        <br />
        Pick a meetup. Tap <strong>I&apos;m in</strong>.
      </MapNotice>
    );
  }

  return null;
}
