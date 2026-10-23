// One-time: adds the DeletedEmail table from
// prisma/migrations/20261023120000_deleted_email to the live database (see
// src/lib/deleted-email.ts). Safe to re-run: a table that's already there
// is left alone. Prints the table's columns and a count only.
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

await client.execute(`CREATE TABLE IF NOT EXISTS "DeletedEmail" (
    "emailHash" TEXT NOT NULL PRIMARY KEY,
    "gender" TEXT NOT NULL,
    "deletedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);
const cols = (await client.execute(`PRAGMA table_info("DeletedEmail")`)).rows.map((r) => r.name);
if (cols.join(",") !== "emailHash,gender,deletedAt") {
  console.error(`DeletedEmail isn't right: ${cols.join(", ")}`);
  process.exit(1);
}
const { rows } = await client.execute(`SELECT count(*) AS n FROM "DeletedEmail"`);
console.log(`DeletedEmail columns: ${cols.join(", ")}; rows: ${rows[0].n}`);
