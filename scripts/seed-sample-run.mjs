import { randomUUID } from "crypto";
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN");
  process.exit(1);
}

const client = createClient({ url, authToken });

const admin = await client.execute("SELECT id FROM \"User\" WHERE role = 'ADMIN' LIMIT 1");
const hostId = admin.rows[0]?.id;
if (!hostId) {
  console.error("No ADMIN user found to host the sample run.");
  process.exit(1);
}

// A week from now, 9am.
const startsAt = new Date();
startsAt.setDate(startsAt.getDate() + 7);
startsAt.setHours(9, 0, 0, 0);

const id = randomUUID();
await client.execute({
  sql: `INSERT INTO "RunActivity"
      ("id", "hostId", "title", "description", "location", "latitude", "longitude", "startsAt", "distanceKm", "pace", "maxParticipants")
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  args: [
    id,
    hostId,
    "Fulham riverside 5K",
    "Easy-paced loop along the Thames path, starting and finishing at Bishop's Park.",
    "Bishop's Park, Fulham, London",
    51.475,
    -0.1958,
    startsAt.toISOString(),
    5,
    "6:00 / km",
    15,
  ],
});

console.log(`Created sample run ${id} in Fulham, London, starting ${startsAt.toISOString()}.`);

client.close();
