// A week of made-up meetups, so an empty app has something to look at.
//
// Everything this creates carries a "demo-" id prefix, which is the whole
// trick: real rows get cuids, so nothing real can ever start with it, and
// clearing up is a handful of LIKE 'demo-%' deletes rather than a list of
// ids someone has to keep. Re-running clears first, so the dates are
// always the coming week and you never end up with two of each.
//
//   node scripts/seed-demo-week.mjs          seed (clears the old demo set first)
//   node scripts/seed-demo-week.mjs --clear  remove every demo row, add nothing
//
// The demo members are real User rows, because a meetup nobody is going to
// looks like a dead app: the pins show a face and a count, and those come
// from Participation. They can't be logged into (the password is a random
// UUID nobody keeps), they hold no invite code, and their addresses are on
// .invalid, which by RFC can never resolve, so no mail can ever reach them.

import { randomUUID } from "crypto";
import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";

const clearOnly = process.argv.includes("--clear");

// Turso in CI/production, a local file when run from a checkout.
const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Set TURSO_DATABASE_URL (+ TURSO_AUTH_TOKEN), or DATABASE_URL for a local file.");
  process.exit(1);
}
const client = createClient({
  url,
  authToken: process.env.TURSO_DATABASE_URL ? process.env.TURSO_AUTH_TOKEN : undefined,
});

// Prisma stores SQLite DateTimes as text with an explicit offset rather
// than a "Z", so match that exactly: a column with two spellings in it is
// a sorting bug waiting to happen.
const sqlDate = (d) => d.toISOString().replace("Z", "+00:00");

/** Today at 00:00 UTC, plus a day offset and a time, as a Date. */
function when(dayOffset, hours, minutes) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(hours, minutes, 0, 0);
  return d;
}

const MEMBERS = [
  { key: "ayo", name: "Ayo", city: "Peckham", pace: "5:10 / km", bio: "Half marathon in the spring, so most weeks are just miles. Always up for coffee after." },
  { key: "mira", name: "Mira", city: "Hackney", pace: "6:00 / km", bio: "Slow runner, fast swimmer. Lido all year round, yes even then." },
  { key: "tom", name: "Tom", city: "Camden", pace: "4:45 / km", bio: "Cycles everywhere. Will talk about hills at length if you let him." },
  { key: "priya", name: "Priya", city: "Walthamstow", pace: "5:40 / km", bio: "Here for the after-bit mostly. Knows every decent bakery east of the Lea." },
  { key: "lena", name: "Lena", city: "Brixton", pace: "5:25 / km", bio: "New to London in July. Saying yes to everything until that stops being fun." },
  { key: "sam", name: "Sam", city: "Greenwich", pace: "5:55 / km", bio: "Park walks, pub quizzes, the occasional 10K I regret signing up for." },
];

const MEETUPS = [
  {
    key: "serpentine-5k",
    host: "ayo",
    going: ["mira", "lena"],
    category: "RUN",
    title: "Sunrise 5K round the Serpentine",
    description:
      "Nice and easy loop of the lake before work. We regroup at every corner, nobody gets left behind. Bring something warm for after.",
    location: "Serpentine Bar & Kitchen, Hyde Park, London",
    latitude: 51.5055,
    longitude: -0.1653,
    day: 1,
    hour: 7,
    minute: 0,
    distanceKm: 5,
    pace: "5:45 / km",
    maxParticipants: 12,
    afterSpot: "Serpentine Bar & Kitchen, coffees on the terrace",
  },
  {
    key: "shoreditch-pint",
    host: "priya",
    going: ["tom", "lena", "sam"],
    category: "DRINKS",
    title: "Post-work pint, no running involved",
    description: "Table booked under Priya. Come for one, stay for four, entirely up to you.",
    location: "The Old Blue Last, Great Eastern Street, London",
    latitude: 51.5253,
    longitude: -0.0798,
    day: 1,
    hour: 18,
    minute: 30,
    maxParticipants: 20,
  },
  {
    key: "lido-dip",
    host: "mira",
    going: ["sam"],
    category: "SWIM",
    title: "Early dip at London Fields Lido",
    description:
      "Heated, so it's nowhere near as brave as it sounds. Lanes are quiet before seven. Bring a pound coin for the lockers.",
    location: "London Fields Lido, Hackney, London",
    latitude: 51.5405,
    longitude: -0.0625,
    day: 2,
    hour: 6,
    minute: 45,
    maxParticipants: 8,
    afterSpot: "Pavilion, for the eggs",
  },
  {
    key: "vicky-park-10k",
    host: "lena",
    going: ["ayo", "priya", "mira"],
    category: "RUN",
    title: "Victoria Park 10K, chatty pace",
    description:
      "Two laps of the park at a pace you can hold a conversation at. If you can't talk, we're going too fast and I want to know.",
    location: "Bonner Gate, Victoria Park, London",
    latitude: 51.5362,
    longitude: -0.04,
    day: 2,
    hour: 18,
    minute: 45,
    distanceKm: 10,
    pace: "6:00 / km",
    maxParticipants: 15,
    afterSpot: "The Royal Inn on the Park",
  },
  {
    key: "borough-coffee",
    host: "sam",
    going: ["priya"],
    category: "COFFEE",
    title: "Flat whites before work",
    description: "Half an hour, one coffee, then everyone goes and does their day. Easiest possible first meetup.",
    location: "Monmouth Coffee, Borough Market, London",
    latitude: 51.5053,
    longitude: -0.0906,
    day: 3,
    hour: 8,
    minute: 0,
    maxParticipants: 10,
  },
  {
    key: "battersea-circuits",
    host: "tom",
    going: ["ayo", "lena"],
    category: "GYM",
    title: "Circuits in the park (bring a mat)",
    description:
      "Forty minutes, no equipment beyond a mat and whatever a park bench can do. Every move has an easier version, just ask.",
    location: "Battersea Park, London",
    latitude: 51.4791,
    longitude: -0.158,
    day: 3,
    hour: 19,
    minute: 0,
    maxParticipants: 12,
  },
  {
    key: "richmond-loops",
    host: "tom",
    going: ["ayo", "sam", "mira", "priya"],
    category: "CYCLE",
    title: "Richmond Park loops, no drops",
    description:
      "Three laps for whoever wants them, one is plenty. We wait at the gate between each, so pick your own number.",
    location: "Richmond Gate, Richmond Park, London",
    latitude: 51.4478,
    longitude: -0.2884,
    day: 4,
    hour: 9,
    minute: 0,
    distanceKm: 32,
    pace: "26 km/h",
    maxParticipants: 10,
    afterSpot: "Roehampton Cafe",
  },
  {
    key: "hampstead-ponds",
    host: "mira",
    going: ["lena", "priya", "sam"],
    category: "WALK",
    title: "Hampstead ponds loop + hill",
    description:
      "Proper Sunday-morning wander. Up Parliament Hill for the view, down past the ponds, roughly two hours at a strolling pace.",
    location: "Parliament Hill, Hampstead Heath, London",
    latitude: 51.5589,
    longitude: -0.154,
    day: 5,
    hour: 10,
    minute: 0,
    distanceKm: 8,
    maxParticipants: 16,
    afterSpot: "Kalendar on Swain's Lane",
  },
  {
    key: "greenwich-hills",
    host: "ayo",
    going: ["tom"],
    category: "RUN",
    title: "Greenwich hill reps (yes, really)",
    description:
      "Six times up the hill to the observatory, jog back down between each. Short, horrible, over in forty minutes.",
    location: "Blackheath Gate, Greenwich Park, London",
    latitude: 51.4751,
    longitude: 0.0007,
    day: 6,
    hour: 8,
    minute: 30,
    distanceKm: 7,
    pace: "hard up, easy down",
    maxParticipants: 10,
  },
  {
    key: "primrose-wander",
    host: "lena",
    going: ["mira", "sam", "ayo"],
    category: "SIGHTS",
    title: "Camden to Primrose Hill wander",
    description:
      "Along the canal, through the market, up the hill for the skyline. Good one if you're new here and want the postcard version.",
    location: "Primrose Hill, London",
    latitude: 51.5386,
    longitude: -0.1596,
    day: 7,
    hour: 11,
    minute: 0,
    maxParticipants: 20,
    afterSpot: "The Princess of Wales",
  },
];

async function clearDemo() {
  // Children first: the demo rows are deleted by id prefix rather than by
  // cascade, so this works the same whether or not foreign keys are being
  // enforced on the far end.
  const statements = [
    `DELETE FROM "Comment" WHERE "activityId" LIKE 'demo-%' OR "authorId" LIKE 'demo-%'`,
    `DELETE FROM "Participation" WHERE "activityId" LIKE 'demo-%' OR "userId" LIKE 'demo-%'`,
    `DELETE FROM "Report" WHERE "reporterId" LIKE 'demo-%' OR "reportedUserId" LIKE 'demo-%'`,
    `DELETE FROM "RunActivity" WHERE "id" LIKE 'demo-%' OR "hostId" LIKE 'demo-%'`,
    `DELETE FROM "User" WHERE "id" LIKE 'demo-%'`,
  ];
  let removed = 0;
  for (const sql of statements) {
    const result = await client.execute(sql);
    removed += Number(result.rowsAffected ?? 0);
  }
  return removed;
}

async function seed() {
  const now = sqlDate(new Date());
  // One throwaway password for the lot: never printed, never stored
  // anywhere but as this hash, so no demo account is a way in.
  const passwordHash = await bcrypt.hash(`${randomUUID()}${randomUUID()}`, 12);

  for (const m of MEMBERS) {
    await client.execute({
      sql: `INSERT INTO "User"
              ("id", "name", "email", "passwordHash", "bio", "city", "pace", "role",
               "verificationStatus", "accountStatus", "emailVerifiedAt", "invitesLeft", "createdAt")
            VALUES (?, ?, ?, ?, ?, ?, ?, 'USER', 'APPROVED', 'ACTIVE', ?, 0, ?)`,
      args: [`demo-user-${m.key}`, m.name, `${m.key}@demo.packmates.invalid`, passwordHash, m.bio, m.city, m.pace, now, now],
    });
  }

  for (const meetup of MEETUPS) {
    const id = `demo-${meetup.key}`;
    const startsAt = when(meetup.day, meetup.hour, meetup.minute);
    await client.execute({
      sql: `INSERT INTO "RunActivity"
              ("id", "hostId", "title", "description", "location", "latitude", "longitude",
               "startsAt", "distanceKm", "pace", "maxParticipants", "category", "afterSpot", "createdAt")
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        `demo-user-${meetup.host}`,
        meetup.title,
        meetup.description ?? null,
        meetup.location,
        meetup.latitude,
        meetup.longitude,
        sqlDate(startsAt),
        meetup.distanceKm ?? null,
        meetup.pace ?? null,
        meetup.maxParticipants ?? null,
        meetup.category,
        meetup.afterSpot ?? null,
        now,
      ],
    });

    // The host counts as going, same as posting one through the app does.
    for (const key of [meetup.host, ...meetup.going]) {
      await client.execute({
        sql: `INSERT INTO "Participation" ("id", "activityId", "userId", "status", "joinedAt")
              VALUES (?, ?, ?, 'JOINED', ?)`,
        args: [`demo-going-${meetup.key}-${key}`, id, `demo-user-${key}`, now],
      });
    }

    console.log(`  ${startsAt.toISOString().slice(0, 16).replace("T", " ")}  ${meetup.title}`);
  }
}

const removed = await clearDemo();
if (clearOnly) {
  console.log(`Removed ${removed} demo row(s). Nothing seeded.`);
} else {
  if (removed) console.log(`Cleared ${removed} row(s) from the previous demo set.`);
  await seed();
  console.log(`\nSeeded ${MEETUPS.length} demo meetups and ${MEMBERS.length} demo members.`);
  console.log("Run again with --clear to remove every one of them.");
}

client.close();
