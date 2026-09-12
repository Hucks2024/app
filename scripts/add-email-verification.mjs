import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN");
  process.exit(1);
}

const client = createClient({ url, authToken });

const userCols = (await client.execute('PRAGMA table_info("User")')).rows.map((r) => r.name);
if (userCols.includes("emailVerifiedAt")) {
  console.log('"emailVerifiedAt" already exists on User, skipping.');
} else {
  console.log('Adding "emailVerifiedAt" to User...');
  await client.execute('ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" DATETIME');
  // Everyone who already has an account predates this check. Stamping them
  // verified means switching email on later never locks a member out.
  const stamped = await client.execute(
    'UPDATE "User" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL'
  );
  console.log(`Done. Grandfathered ${stamped.rowsAffected} existing account(s) as verified.`);
}

const tables = await client.execute(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='EmailVerification'"
);
if (tables.rows.length > 0) {
  console.log('"EmailVerification" table already exists, skipping.');
} else {
  console.log('Creating "EmailVerification" table...');
  await client.execute(`
    CREATE TABLE "EmailVerification" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "expiresAt" DATETIME NOT NULL,
      "attempts" INTEGER NOT NULL DEFAULT 0,
      "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "EmailVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await client.execute(
    'CREATE UNIQUE INDEX "EmailVerification_userId_key" ON "EmailVerification"("userId")'
  );
  console.log("Done.");
}

console.log("\nEmail checks stay off until RESEND_API_KEY is set in the environment.");
