import { createClient } from "@libsql/client";

// Two one-time cleanups, both safe to re-run.
//
// 1. Wipes the verification selfies and ID photos. Photo-ID checks are
//    retired (invite codes gate the app now), so these blobs are dead
//    weight sitting in the database, and they're the single biggest thing
//    eating the Turso free tier. Profile photos are NOT touched, those are
//    still shown on avatars.
//
// 2. Strips the "000042-" membership-number prefix off invite codes, so a
//    code is just its eight random characters. The number was never what
//    made a code secure and it still lives on the profile; this only makes
//    codes shorter to read out and type.
const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN");
  process.exit(1);
}

const client = createClient({ url, authToken });

// --- 1. Verification photos -------------------------------------------------
const before = await client.execute(`
  SELECT COUNT(*) AS rows,
         COALESCE(SUM(LENGTH("selfiePhoto")), 0) AS selfieBytes,
         COALESCE(SUM(LENGTH("idPhoto")), 0) AS idBytes
  FROM "VerificationRequest"
`);
const { rows, selfieBytes, idBytes } = before.rows[0];
const totalBytes = Number(selfieBytes) + Number(idBytes);

console.log(`VerificationRequest rows: ${rows}`);
console.log(`Photo bytes stored: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);

if (totalBytes === 0) {
  console.log("Nothing to purge, photos are already cleared.\n");
} else {
  // The rows themselves stay (a few dozen bytes each, and they're the
  // record of what was decided); only the image data goes.
  await client.execute(`
    UPDATE "VerificationRequest"
    SET "selfiePhoto" = zeroblob(0), "selfiePhotoType" = '',
        "idPhoto" = NULL, "idPhotoType" = NULL
  `);
  const after = await client.execute(`
    SELECT COALESCE(SUM(LENGTH("selfiePhoto")), 0) + COALESCE(SUM(LENGTH("idPhoto")), 0) AS bytes
    FROM "VerificationRequest"
  `);
  console.log(`Purged. Photo bytes now: ${after.rows[0].bytes}\n`);
}

// --- 2. Invite codes --------------------------------------------------------
const prefixed = await client.execute(
  `SELECT "id", "email", "inviteCode" FROM "User" WHERE "inviteCode" LIKE '______-%'`
);

if (prefixed.rows.length === 0) {
  console.log("No prefixed invite codes left to shorten.");
} else {
  console.log(`Shortening ${prefixed.rows.length} invite code(s):`);
  for (const row of prefixed.rows) {
    const short = String(row.inviteCode).split("-").pop();
    await client.execute({
      sql: 'UPDATE "User" SET "inviteCode" = ? WHERE "id" = ?',
      args: [short, row.id],
    });
    console.log(`  ${row.email}: ${row.inviteCode} -> ${short}`);
  }
}

// Space freed by the purge goes on SQLite's free list and gets reused, so
// the database stops growing either way; VACUUM is what actually hands it
// back. Not all hosted setups allow it, so a refusal here isn't a failure.
try {
  await client.execute("VACUUM");
  console.log("\nVACUUM done, space reclaimed.");
} catch (e) {
  console.log(`\nVACUUM skipped (${e.message?.slice(0, 80) ?? e}); freed space will be reused in place.`);
}
