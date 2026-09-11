import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN");
  process.exit(1);
}

const client = createClient({ url, authToken });

const userCols = (await client.execute('PRAGMA table_info("User")')).rows.map((r) => r.name);
if (userCols.includes("memberNumber")) {
  console.log('"memberNumber" already exists on User, skipping.');
} else {
  console.log('Adding "memberNumber" to User...');
  await client.execute('ALTER TABLE "User" ADD COLUMN "memberNumber" INTEGER');
  await client.execute('CREATE UNIQUE INDEX "User_memberNumber_key" ON "User"("memberNumber")');
  console.log("Done.");
}

const actCols = (await client.execute('PRAGMA table_info("RunActivity")')).rows.map((r) => r.name);
if (actCols.includes("category")) {
  console.log('"category"/"afterSpot" already exist on RunActivity, skipping.');
} else {
  console.log('Adding "category"/"afterSpot" to RunActivity...');
  await client.execute(
    `ALTER TABLE "RunActivity" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'RUN'`
  );
  await client.execute('ALTER TABLE "RunActivity" ADD COLUMN "afterSpot" TEXT');
  console.log("Done.");
}

// Membership numbers are handed out oldest account first, so whoever was
// here earliest gets the lower number. Invite codes are rebuilt to the
// "NNNNNN-RRRRRR" form so every code carries its owner's number; the random
// half is what actually makes a code unguessable (a code that was only the
// number could be counted through, and invite-only would mean nothing).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const randomPart = () =>
  Array.from({ length: 8 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
const pad = (n) => String(n).padStart(6, "0");

const needNumbers = await client.execute(
  'SELECT "id", "email", "role" FROM "User" WHERE "memberNumber" IS NULL ORDER BY "createdAt" ASC'
);

if (needNumbers.rows.length === 0) {
  console.log("Every account already has a membership number.");
} else {
  const highest = await client.execute('SELECT MAX("memberNumber") AS max FROM "User"');
  let next = (highest.rows[0]?.max ?? 0) + 1;

  console.log(`Assigning membership numbers to ${needNumbers.rows.length} account(s)...`);
  for (const row of needNumbers.rows) {
    const memberNumber = next++;
    const code = `${pad(memberNumber)}-${randomPart()}`;
    await client.execute({
      sql: 'UPDATE "User" SET "memberNumber" = ?, "inviteCode" = ? WHERE "id" = ?',
      args: [memberNumber, code, row.id],
    });
    console.log(`  #${pad(memberNumber)} ${row.role === "ADMIN" ? "[admin] " : ""}${row.email}`);
    console.log(`     invite code: ${code}`);
  }
}

console.log("\nCodes above replace the earlier ones, hand out an admin code to invite people.");
