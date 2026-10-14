import { subDays } from "date-fns";
import type { PrismaClient } from "@prisma/client";
import type { CurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { refreshVerified, thumbsFor } from "@/lib/trust";
import { goingCounts, liveMeetup } from "@/lib/meetups";
import { blockedEitherWay } from "@/lib/blocks";
import MeetupBoard from "@/components/MeetupBoard";
import MapNotice from "@/components/MapNotice";

// The map of upcoming meetups. Only reachable by members, both "/" and
// "/activities" gate on requireUser() before rendering this, so there's
// no "you're not a member yet" branch to handle here.
export default async function RunsScreen({ user }: { user: CurrentUser }) {
  const prisma = await getPrisma();
  const now = new Date();

  // Nothing here waits on anything else, so it's all asked for at once.
  const [{ verified, justVerified }, blocked, upcoming, toThank] = await Promise.all([
    refreshVerified(prisma, user),
    // Not the meetups of anyone they've blocked, or who's blocked them.
    blockedEitherWay(prisma, user.id),
    prisma.runActivity.findMany({
      // Only the ones with a pin: the map has nowhere to put the rest.
      where: { startsAt: { gte: now }, ...liveMeetup, latitude: { not: null }, longitude: { not: null } },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        hostId: true,
        title: true,
        location: true,
        startsAt: true,
        latitude: true,
        longitude: true,
        distanceKm: true,
        pace: true,
        category: true,
        afterSpot: true,
        maxParticipants: true,
      },
    }),
    meetupToThank(prisma, user.id, now),
  ]);
  const activities = upcoming.filter((a) => !blocked.has(a.hostId));
  const hostIds = [...new Set(activities.map((a) => a.hostId))];

  // The host's 👍 is the trust signal at the point of choosing: it's what
  // somebody new looks at before saying they'll turn up. And how many are
  // going, for the number on the pin.
  const [hosts, thumbs, going] = await Promise.all([
    hostIds.length ? prisma.user.findMany({ where: { id: { in: hostIds } }, select: { id: true, name: true } }) : [],
    thumbsFor(prisma, hostIds),
    goingCounts(
      prisma,
      activities.map((a) => a.id)
    ),
  ]);
  const hostName = new Map(hosts.map((h) => [h.id, h.name]));

  const mapActivities = activities.map((a) => ({
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
    joinedCount: going.get(a.id) ?? 0,
    maxParticipants: a.maxParticipants,
    host: { name: hostName.get(a.hostId) ?? "", thumbs: thumbs.get(a.hostId) ?? 0 },
  }));

  return (
    // No heading row. The chips below already say what you're looking at,
    // and on a phone that row was costing the map about 90px to tell
    // members something they knew. Posting moved to the floating button,
    // where it's bigger and always within thumb reach.
    <>
      <h1 className="sr-only">Meetups near you</h1>
      <MeetupBoard
        activities={mapActivities}
        post={{ href: "/activities/new", label: verified ? "Post a meetup" : "How to post a meetup" }}
        canPost={verified}
        notice={noticeFor(verified, justVerified, toThank)}
      />
    </>
  );
}

/** The latest meetup from the last week that this member went to with
 * somebody else, and hasn't given anyone there a thumbs up yet. */
async function meetupToThank(prisma: PrismaClient, userId: string, now: Date) {
  const recent = await prisma.participation.findFirst({
    where: {
      userId,
      status: "JOINED",
      activity: {
        startsAt: { gte: subDays(now, 7), lte: now },
        cancelledAt: null,
        thumbsUps: { none: { fromId: userId } },
        // Nobody else there, nobody to thank.
        participations: { some: { status: "JOINED", userId: { not: userId } } },
      },
    },
    orderBy: { activity: { startsAt: "desc" } },
    select: { activity: { select: { id: true, title: true } } },
  });
  return recent?.activity ?? null;
}

/** The one thing worth saying to this member on the map right now, most
 * important first, or nothing. */
function noticeFor(verified: boolean, justVerified: boolean, recent: { id: string; title: string } | null) {
  if (justVerified) {
    return (
      <MapNotice id="verified">
        <strong className="text-slate-900">🎉 You can post now</strong>
        <br />
        Tap <strong>Post</strong> below.
      </MapNotice>
    );
  }

  if (recent) {
    return (
      <MapNotice
        id={`thumbs-${recent.id}`}
        href={`/activities/${recent.id}#people`}
        cta="Give thumbs up"
      >
        <strong className="text-slate-900">How was {recent.title}? 👍</strong>
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
