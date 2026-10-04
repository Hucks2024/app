// Makes one member an admin, by email.
//
// For when there's nobody signed in as an admin to do it from /admin
// (where "Make admin" is the normal way). Prints nothing that identifies
// the member beyond what was typed in: this repository is public, and so
// are its Actions logs.
import { createClient } from "@libsql/client";

const email = (process.env.MEMBER_EMAIL ?? "").trim().toLowerCase();
if (!email) {
  console.error("Set MEMBER_EMAIL to the member's email address.");
  process.exit(1);
}
const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Set TURSO_DATABASE_URL (+ TURSO_AUTH_TOKEN), or DATABASE_URL for a local file.");
  process.exit(1);
}
const client = createClient({
  url,
  authToken: process.env.TURSO_DATABASE_URL ? process.env.TURSO_AUTH_TOKEN : undefined,
});

const found = await client.execute({
  sql: 'SELECT "id", "role", "accountStatus" FROM "User" WHERE lower("email") = ?',
  args: [email],
});
if (found.rows.length === 0) {
  console.error("No account with that email. They need to sign up first.");
  process.exit(1);
}
const user = found.rows[0];
console.log(`Found the account. Role before: ${user.role}, status: ${user.accountStatus}.`);

await client.execute({
  sql: `UPDATE "User"
        SET "role" = 'ADMIN',
            "accountStatus" = 'ACTIVE',
            "memberVerifiedAt" = COALESCE("memberVerifiedAt", ?)
        WHERE "id" = ?`,
  args: [new Date().toISOString().replace("Z", "+00:00"), user.id],
});

const after = await client.execute({
  sql: 'SELECT "role", "accountStatus" FROM "User" WHERE "id" = ?',
  args: [user.id],
});
console.log(`Role now: ${after.rows[0].role}, status: ${after.rows[0].accountStatus}.`);
client.close();
