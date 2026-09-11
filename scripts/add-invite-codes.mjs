import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN");
  process.exit(1);
}

const client = createClient({ url, authToken });

const userColumns = await client.execute('PRAGMA table_info("User")');
const userColumnNames = userColumns.rows.map((r) => r.name);

if (userColumnNames.includes("inviteCode")) {
  console.log('Invite columns already exist on User, skipping the schema change.');
} else {
  console.log("Adding inviteCode/invitedById/invitesLeft columns to User...");
  await client.execute('ALTER TABLE "User" ADD COLUMN "inviteCode" TEXT');
  await client.execute(
    'ALTER TABLE "User" ADD COLUMN "invitedById" TEXT REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE'
  );
  await client.execute('ALTER TABLE "User" ADD COLUMN "invitesLeft" INTEGER NOT NULL DEFAULT 5');
  // SQLite/libSQL can't do "ADD COLUMN ... UNIQUE", a separate unique index
  // does the same job.
  await client.execute('CREATE UNIQUE INDEX "User_inviteCode_key" ON "User"("inviteCode")');
  console.log("Done.");
}

// Backfill: without a code on at least one existing account, nobody can
// sign up at all, since signup now demands a valid one. Same alphabet as
// src/lib/invite.ts (no 0/O/1/I/L).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function randomCode() {
  let out = "";
  for (let i = 0; i < 8; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

const needCodes = await client.execute(
  'SELECT "id", "name", "email", "role" FROM "User" WHERE "inviteCode" IS NULL'
);

if (needCodes.rows.length === 0) {
  console.log("Every account already has an invite code.");
} else {
  console.log(`Minting invite codes for ${needCodes.rows.length} existing account(s)...`);
  for (const row of needCodes.rows) {
    let assigned = null;
    for (let attempt = 0; attempt < 10 && !assigned; attempt++) {
      const code = randomCode();
      try {
        await client.execute({
          sql: 'UPDATE "User" SET "inviteCode" = ? WHERE "id" = ?',
          args: [code, row.id],
        });
        assigned = code;
      } catch (e) {
        if (!String(e).includes("UNIQUE")) throw e;
      }
    }
    if (!assigned) throw new Error(`Could not mint a unique code for ${row.email}`);
    console.log(`  ${row.role === "ADMIN" ? "[admin] " : ""}${row.email}: ${assigned}`);
  }
}

console.log("\nShare an admin code above to let the first people in.");
