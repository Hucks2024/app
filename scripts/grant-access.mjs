import { createClient } from "@libsql/client";

// Opens the app up for one member, by email.
//
// Normally nothing needs this: membership is free (MEMBERSHIP_REQUIRED is
// off) and photo-ID verification is retired, so an invited account can post
// meetups the moment it's created. It exists for the in-between case, an
// account created under the older rules, or one sitting behind a build that
// still enforces them, that needs unsticking without waiting for a deploy.
//
// Sets both of the old gates at once: a long-dated paidUntil and an
// APPROVED verification status. Both are ignored by the current code, so
// this is safe either way.
const email = (process.env.MEMBER_EMAIL ?? "").trim().toLowerCase();
const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!email) {
  console.error("Set MEMBER_EMAIL to the member's email address.");
  process.exit(1);
}
if (!url || !authToken) {
  console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN");
  process.exit(1);
}

const client = createClient({ url, authToken });

const found = await client.execute({
  sql: 'SELECT "id", "name", "email", "memberNumber", "verificationStatus", "paidUntil" FROM "User" WHERE lower("email") = ?',
  args: [email],
});

if (found.rows.length === 0) {
  console.error(`No account found for ${email}`);
  process.exit(1);
}

const user = found.rows[0];
console.log(`Found ${user.name} <${user.email}>`);
console.log(`  before: verification=${user.verificationStatus} paidUntil=${user.paidUntil ?? "none"}`);

const tenYears = new Date();
tenYears.setUTCFullYear(tenYears.getUTCFullYear() + 10);

await client.execute({
  sql: 'UPDATE "User" SET "verificationStatus" = ?, "paidUntil" = ? WHERE "id" = ?',
  args: ["APPROVED", tenYears.toISOString(), user.id],
});

const after = await client.execute({
  sql: 'SELECT "verificationStatus", "paidUntil" FROM "User" WHERE "id" = ?',
  args: [user.id],
});
console.log(
  `  after:  verification=${after.rows[0].verificationStatus} paidUntil=${after.rows[0].paidUntil}`
);
console.log("\nThey can post meetups now. They may need to reload the page.");
