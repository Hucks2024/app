// One-time schema change for login lockout, sign-out-everywhere on a
// password change, and cancelled meetups (see
// prisma/migrations/20261004140000_lockout_and_cancelled_meetups). Turso
// speaks HTTP rather than the wire protocol prisma migrate deploy needs,
// so the change is applied here instead. Checks before every step, so
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

async function addColumn(table, column, definition) {
  const cols = (await client.execute(`PRAGMA table_info("${table}")`)).rows.map((r) => r.name);
  if (cols.includes(column)) {
    console.log(`"${column}" already exists on ${table}, skipping.`);
    return;
  }
  console.log(`Adding "${column}" to ${table}...`);
  await client.execute(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
}

await addColumn("User", "failedLogins", "INTEGER NOT NULL DEFAULT 0");
await addColumn("User", "lockedUntil", "DATETIME");
await addColumn("User", "passwordChangedAt", "DATETIME");
await addColumn("RunActivity", "cancelledAt", "DATETIME");

console.log("\nDone.");
client.close();
