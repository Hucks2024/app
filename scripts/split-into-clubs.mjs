import { createClient } from "@libsql/client";

// One-time migration for the Pacemates/Packmates split.
//
// Adds the "club" column to User and RunActivity, re-scopes the two unique
// indexes that used to be global (email, memberNumber) so each club has its
// own namespace, and gives Packmates a founding admin so its side isn't
// dead on arrival.
//
// Everything that already exists becomes Pacemates: the app was
// Pacemates-shaped long before Packmates existed, and every account and
// meetup in there was created on that understanding.
//
// Safe to re-run: every step checks first.

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN");
  process.exit(1);
}

const client = createClient({ url, authToken });

const columns = async (table) =>
  (await client.execute(`PRAGMA table_info("${table}")`)).rows.map((r) => r.name);
const indexes = async (table) =>
  (await client.execute(`PRAGMA index_list("${table}")`)).rows.map((r) => r.name);

// --- 1. the column --------------------------------------------------------

for (const table of ["User", "RunActivity"]) {
  if ((await columns(table)).includes("club")) {
    console.log(`"club" already exists on ${table}, skipping.`);
  } else {
    console.log(`Adding "club" to ${table}...`);
    await client.execute(`ALTER TABLE "${table}" ADD COLUMN "club" TEXT NOT NULL DEFAULT 'PACE'`);
  }
}

// --- 2. the indexes -------------------------------------------------------

// Global -> per club. Dropped before created: an account can now exist
// twice, once per club, and the old index would forbid exactly that.
const userIndexes = await indexes("User");

if (userIndexes.includes("User_club_email_key")) {
  console.log("Email index is already club-scoped, skipping.");
} else {
  console.log("Re-scoping the email index to the club...");
  if (userIndexes.includes("User_email_key")) {
    await client.execute('DROP INDEX "User_email_key"');
  }
  await client.execute('CREATE UNIQUE INDEX "User_club_email_key" ON "User"("club", "email")');
}

if (userIndexes.includes("User_club_memberNumber_key")) {
  console.log("Member-number index is already club-scoped, skipping.");
} else {
  console.log("Re-scoping the member-number index to the club...");
  if (userIndexes.includes("User_memberNumber_key")) {
    await client.execute('DROP INDEX "User_memberNumber_key"');
  }
  await client.execute(
    'CREATE UNIQUE INDEX "User_club_memberNumber_key" ON "User"("club", "memberNumber")'
  );
}

// --- 3. a founding admin for Packmates ------------------------------------

// Packmates starts with nobody in it, and nobody can join a club with no
// member to invite them, so each existing admin gets a matching Packmates
// account: same name, same email, same password (the hash is copied, not
// reset), its own #1 and its own invite code. Exactly what they'd get by
// signing up on the other side, which is what holding two memberships
// means here.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const randomCode = () =>
  Array.from({ length: 8 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
const newId = () =>
  `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`.slice(0, 25);
const pad = (n) => String(n).padStart(6, "0");

const admins = await client.execute(
  `SELECT "id", "name", "email", "passwordHash" FROM "User"
   WHERE "role" = 'ADMIN' AND "club" = 'PACE' ORDER BY "createdAt" ASC`
);

if (admins.rows.length === 0) {
  console.log("\nNo Pacemates admin to mirror. Packmates has no founding member yet.");
}

for (const admin of admins.rows) {
  const already = await client.execute({
    sql: `SELECT "inviteCode" FROM "User" WHERE "club" = 'PACK' AND "email" = ?`,
    args: [admin.email],
  });
  if (already.rows.length > 0) {
    console.log(`\nPackmates admin for ${admin.email} already exists.`);
    console.log(`  invite code: ${already.rows[0].inviteCode}`);
    continue;
  }

  const highest = await client.execute(
    `SELECT MAX("memberNumber") AS max FROM "User" WHERE "club" = 'PACK'`
  );
  const memberNumber = (highest.rows[0]?.max ?? 0) + 1;
  const inviteCode = randomCode();

  await client.execute({
    sql: `INSERT INTO "User"
            ("id", "club", "name", "email", "passwordHash", "role",
             "verificationStatus", "accountStatus", "emailVerifiedAt",
             "memberNumber", "inviteCode", "invitesLeft", "createdAt")
          VALUES (?, 'PACK', ?, ?, ?, 'ADMIN',
                  'UNSUBMITTED', 'ACTIVE', CURRENT_TIMESTAMP,
                  ?, ?, 5, CURRENT_TIMESTAMP)`,
    args: [newId(), admin.name, admin.email, admin.passwordHash, memberNumber, inviteCode],
  });

  console.log(`\nCreated the founding Packmates admin for ${admin.email}`);
  console.log(`  member:      #${pad(memberNumber)}`);
  console.log(`  invite code: ${inviteCode}`);
  console.log(`  password:    the same one you already use for Pacemates`);
}

// --- summary --------------------------------------------------------------

const counts = await client.execute(`SELECT "club", COUNT(*) AS n FROM "User" GROUP BY "club"`);
console.log("\nMembers per club:");
for (const row of counts.rows) {
  console.log(`  ${row.club}: ${row.n}`);
}
console.log("\nDone.");
