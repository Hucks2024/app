// One-time: adds the "durationMins" column from
// prisma/migrations/20261022120000_meetup_duration to the live database, so
// a walk, run or ride can say how long it takes. Safe to re-run: a column
// that's already there is left alone. Prints the column list and a count
// only, never any data.
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

const columns = async () => (await client.execute(`PRAGMA table_info("RunActivity")`)).rows.map((r) => r.name);

if ((await columns()).includes("durationMins")) {
  console.log("already there: RunActivity.durationMins");
} else {
  await client.execute(`ALTER TABLE "RunActivity" ADD COLUMN "durationMins" INTEGER`);
  console.log("added: RunActivity.durationMins");
}
const now = await columns();
if (!now.includes("durationMins")) {
  console.error("The column still isn't there.");
  process.exit(1);
}
const { rows } = await client.execute(`SELECT count(*) AS n FROM "RunActivity"`);
console.log(`RunActivity columns: ${now.join(", ")}`);
console.log(`meetups: ${rows[0].n} (unchanged)`);
