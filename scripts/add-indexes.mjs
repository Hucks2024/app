// One-time: adds the indexes from prisma/migrations/20261014120000_indexes
// to the live database, so the map, Me and the red flag count look rows up
// instead of reading whole tables. Safe to re-run: an index that's already
// there is left alone. Prints query plans only, never any data.
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Set TURSO_DATABASE_URL (+ TURSO_AUTH_TOKEN), or DATABASE_URL for a local file.");
  process.exit(1);
}
const client = createClient({
  url,
  authToken: process.env.TURSO_DATABASE_URL ? process.env.TURSO_AUTH_TOKEN : undefined,
});

const INDEXES = [
  `CREATE INDEX IF NOT EXISTS "Participation_userId_idx" ON "Participation"("userId")`,
  `CREATE INDEX IF NOT EXISTS "Report_reportedUserId_idx" ON "Report"("reportedUserId")`,
  `CREATE INDEX IF NOT EXISTS "RunActivity_startsAt_idx" ON "RunActivity"("startsAt")`,
  `CREATE INDEX IF NOT EXISTS "RunActivity_hostId_idx" ON "RunActivity"("hostId")`,
];
for (const sql of INDEXES) {
  await client.execute(sql);
  console.log(`done: ${sql.match(/"(\w+_idx)"/)[1]}`);
}

// What the database now does for the busiest lookups.
const CHECKS = {
  "map (what's coming up)": `SELECT "id" FROM "RunActivity" WHERE "startsAt" >= ? AND "cancelledAt" IS NULL ORDER BY "startsAt"`,
  "Me (my meetups)": `SELECT "id" FROM "Participation" WHERE "userId" = ? AND "status" = 'JOINED'`,
  "red flags": `SELECT "id" FROM "Report" WHERE "reportedUserId" = ?`,
};
for (const [name, sql] of Object.entries(CHECKS)) {
  const plan = await client.execute({ sql: `EXPLAIN QUERY PLAN ${sql}`, args: [0] });
  console.log(`${name}: ${plan.rows.map((r) => r.detail).join(" / ")}`);
}
