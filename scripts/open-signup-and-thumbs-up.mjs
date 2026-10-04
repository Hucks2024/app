// One-time schema change for open signup, thumbs up and "verified member"
// (see prisma/migrations/20261004120000_open_signup_and_thumbs_up). Turso
// speaks HTTP rather than the wire protocol prisma migrate deploy needs, so
// the change is applied here instead. Every step checks before it acts, so
// it's safe to re-run.
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

const userCols = (await client.execute('PRAGMA table_info("User")')).rows.map((r) => r.name);

for (const [col, type] of [
  ["appleSub", "TEXT"],
  ["googleSub", "TEXT"],
  ["memberVerifiedAt", "DATETIME"],
]) {
  if (userCols.includes(col)) {
    console.log(`"${col}" already exists on User, skipping.`);
  } else {
    console.log(`Adding "${col}" to User...`);
    await client.execute(`ALTER TABLE "User" ADD COLUMN "${col}" ${type}`);
  }
}

await client.execute('CREATE UNIQUE INDEX IF NOT EXISTS "User_appleSub_key" ON "User"("appleSub")');
await client.execute('CREATE UNIQUE INDEX IF NOT EXISTS "User_googleSub_key" ON "User"("googleSub")');

const tables = await client.execute(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='ThumbsUp'"
);
if (tables.rows.length > 0) {
  console.log('"ThumbsUp" table already exists, skipping.');
} else {
  console.log('Creating "ThumbsUp" table...');
  await client.execute(`
    CREATE TABLE "ThumbsUp" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "activityId" TEXT NOT NULL,
      "fromId" TEXT NOT NULL,
      "toId" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ThumbsUp_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "RunActivity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "ThumbsUp_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "ThumbsUp_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
}
await client.execute('CREATE INDEX IF NOT EXISTS "ThumbsUp_toId_idx" ON "ThumbsUp"("toId")');
await client.execute(
  'CREATE UNIQUE INDEX IF NOT EXISTS "ThumbsUp_activityId_fromId_toId_key" ON "ThumbsUp"("activityId", "fromId", "toId")'
);

// Everyone here before signup opened came in on a member's invite code,
// which is a stronger vouch than one meetup: they start out verified.
// Only on the run that adds the column: a re-run after open signup would
// otherwise wave every new account straight past the first-meetup rule.
if (!userCols.includes("memberVerifiedAt")) {
  const stamped = await client.execute(
    'UPDATE "User" SET "memberVerifiedAt" = "createdAt" WHERE "memberVerifiedAt" IS NULL'
  );
  console.log(`Stamped ${stamped.rowsAffected} existing member(s) as verified.`);
} else {
  console.log("Existing members were already stamped on the first run, leaving them be.");
}

console.log("\nDone.");
client.close();
