// One-time: brings the live database up to date with
// prisma/migrations/20261022120000_meetup_duration and 20261022130000_gender:
//
// - RunActivity.durationMins: how long a walk, run or ride takes.
// - RunActivity.forWho: who a meetup is for. Every meetup so far is for all.
// - User.gender: male, female or T-Rex. Everybody who joined before this
//   is male (the owner's word), so they're set to that.
//
// Safe to re-run: columns already there are left alone, and only members
// with no gender yet are set. Prints column names and counts only, never
// anybody's details.
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

const columns = async (table) => (await client.execute(`PRAGMA table_info("${table}")`)).rows.map((r) => r.name);

async function addColumn(table, column, type) {
  if ((await columns(table)).includes(column)) {
    console.log(`already there: ${table}.${column}`);
    return;
  }
  await client.execute(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${type}`);
  if (!(await columns(table)).includes(column)) {
    console.error(`${table}.${column} still isn't there.`);
    process.exit(1);
  }
  console.log(`added: ${table}.${column}`);
}

await addColumn("RunActivity", "durationMins", "INTEGER");
await addColumn("RunActivity", "forWho", "TEXT NOT NULL DEFAULT 'ALL'");
await addColumn("User", "gender", "TEXT");

const set = await client.execute(`UPDATE "User" SET "gender" = 'MALE' WHERE "gender" IS NULL`);
console.log(`members set to male: ${set.rowsAffected}`);

const count = async (sql) => (await client.execute(sql)).rows[0].n;
console.log(`members: ${await count(`SELECT count(*) AS n FROM "User"`)}, with no gender: ${await count(`SELECT count(*) AS n FROM "User" WHERE "gender" IS NULL`)}`);
console.log(`meetups: ${await count(`SELECT count(*) AS n FROM "RunActivity"`)} (unchanged), mixed: ${await count(`SELECT count(*) AS n FROM "RunActivity" WHERE "forWho" = 'ALL'`)}`);
