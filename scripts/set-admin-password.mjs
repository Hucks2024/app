// Gives the admin a new password, for when they've forgotten it and email
// (the normal "Forgot your password?") isn't set up yet.
//
// The password comes from the repository secret NEW_ADMIN_PASSWORD, never
// from a typed-in input: this repository is public, and so are its Actions
// logs. It's only ever stored scrambled, like every other password. Works
// only while there's exactly one admin, so it can't land on the wrong one.
import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";

const password = process.env.NEW_ADMIN_PASSWORD ?? "";
if (password.length < 8) {
  console.error("Add a repository secret NEW_ADMIN_PASSWORD of 8 or more characters first.");
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

const admins = (
  await client.execute(`SELECT "id" FROM "User" WHERE "role" = 'ADMIN' AND "id" NOT LIKE 'demo-%'`)
).rows;
if (admins.length !== 1) {
  console.error(`There are ${admins.length} admins, so it isn't clear whose password to change. Nothing changed.`);
  process.exit(1);
}

// As the app does on a reset: signed out everywhere, any lock cleared.
const changedAt = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString().replace("Z", "+00:00");
await client.execute({
  sql: `UPDATE "User"
        SET "passwordHash" = ?, "passwordChangedAt" = ?, "failedLogins" = 0, "lockedUntil" = NULL
        WHERE "id" = ?`,
  args: [await bcrypt.hash(password, 12), changedAt, admins[0].id],
});
console.log("Done. Sign in with your email and the new password, then delete the NEW_ADMIN_PASSWORD secret.");
client.close();
