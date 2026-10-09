// One-time schema change for blocking (see
// prisma/migrations/20261009120000_blocks). Turso speaks HTTP rather than
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

await client.execute(`CREATE TABLE IF NOT EXISTS "Block" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
)`);
await client.execute(`CREATE INDEX IF NOT EXISTS "Block_blockedId_idx" ON "Block"("blockedId")`);
await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "Block_blockerId_blockedId_key" ON "Block"("blockerId", "blockedId")`);

const cols = (await client.execute(`PRAGMA table_info("Block")`)).rows.map((r) => r.name);
console.log(`Block table ready: ${cols.join(", ")}`);
client.close();
