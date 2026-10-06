// One-time schema change for "How will people find you?" on meetups (see
// prisma/migrations/20261006100000_find_us). Turso speaks HTTP rather than
// the wire protocol prisma migrate deploy needs, so the change is applied
// here instead. Safe to re-run.
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

const cols = (await client.execute('PRAGMA table_info("RunActivity")')).rows.map((r) => r.name);
if (cols.includes("findUs")) {
  console.log('"findUs" already exists on RunActivity, skipping.');
} else {
  console.log('Adding "findUs" to RunActivity...');
  await client.execute('ALTER TABLE "RunActivity" ADD COLUMN "findUs" TEXT');
}
console.log("\nDone.");
client.close();
