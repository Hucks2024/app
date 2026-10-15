import type { PrismaClient } from "@prisma/client";

// Levels: a bit of game on top of the real thing. Points come only from
// what the app is for, so the way to level up is to go out and meet
// people: every meetup you've been to with somebody else, and every
// thumbs up somebody gave you after one.
//
// Each level takes a little longer than the one before (10 points, then
// 20 more, then 30 more...), so the first few come quickly.

export const POINTS = { meetup: 10, thumbsUp: 5 };

const TITLES = [
  { emoji: "🐾", title: "Pup" },
  { emoji: "🧭", title: "Scout" },
  { emoji: "🤝", title: "Packmate" },
  { emoji: "🔥", title: "Trailblazer" },
  { emoji: "🐺", title: "Pack leader" },
  { emoji: "👑", title: "Legend" },
];

/** Points needed to reach a level: 0, 10, 30, 60, 100... */
const pointsFor = (level: number) => 5 * level * (level - 1);

export type Level = {
  level: number;
  emoji: string;
  title: string;
  points: number;
  // Points into this level, and how many the whole level takes.
  into: number;
  span: number;
};

export function levelFor(meetups: number, thumbsUp: number): Level {
  const points = meetups * POINTS.meetup + thumbsUp * POINTS.thumbsUp;
  let level = 1;
  while (pointsFor(level + 1) <= points) level++;
  const { emoji, title } = TITLES[Math.min(level, TITLES.length) - 1];
  return { level, emoji, title, points, into: points - pointsFor(level), span: pointsFor(level + 1) - pointsFor(level) };
}

/** How many meetups this member has been to with at least one other
 * person: started, not called off, and somebody else there too, so a
 * meetup nobody came to doesn't count. */
export function meetupsBeenTo(prisma: PrismaClient, userId: string, now: Date): Promise<number> {
  return prisma.participation.count({
    where: {
      userId,
      status: "JOINED",
      activity: {
        startsAt: { lte: now },
        cancelledAt: null,
        participations: { some: { status: "JOINED", userId: { not: userId } } },
      },
    },
  });
}
