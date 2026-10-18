// One-time: adds the "emoji" column from
// prisma/migrations/20261018120000_meetup_emoji to the live database, so a
// "Something else" meetup can carry its own emoji on the map. Safe to
// re-run: a column that's already there is left alone. Prints the
// column list and a count only, never any data.
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

if ((await columns()).includes("emoji")) {
  console.log("already there: RunActivity.emoji");
} else {
  await client.execute(`ALTER TABLE "RunActivity" ADD COLUMN "emoji" TEXT`);
  console.log("added: RunActivity.emoji");
}
const now = await columns();
if (!now.includes("emoji")) {
  console.error("The column still isn't there.");
  process.exit(1);
}
const { rows } = await client.execute(`SELECT count(*) AS n FROM "RunActivity"`);
console.log(`RunActivity columns: ${now.join(", ")}`);
console.log(`meetups: ${rows[0].n} (unchanged)`);
