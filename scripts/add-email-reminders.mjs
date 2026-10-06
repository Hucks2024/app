// One-time schema change for reminder emails (see
// prisma/migrations/20261006140000_email_reminders). Turso speaks HTTP
// rather than the wire protocol prisma migrate deploy needs, so the change
// is applied here instead. Safe to re-run.
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

await addColumn("User", "emailReminders", "BOOLEAN NOT NULL DEFAULT true");
await addColumn("Participation", "reminderSentAt", "DATETIME");
console.log("\nDone.");
client.close();
