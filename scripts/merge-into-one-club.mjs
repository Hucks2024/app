import { createClient } from "@libsql/client";

// One-time migration undoing the Pacemates/Packmates split: one app, one
// member list, called Packmates.
//
// The split gave every account a club and made email unique per club, so
// one person could hold a membership on each side. Undoing that can
// therefore find the same address twice, and the two rows have to become
// one before a global unique index will go back on.
//
// Where an address appears twice, the older account wins: it's the one
// with the history, the invite chain and the meetups hanging off it.
// Everything owned by the newer one is moved across before it's deleted,
// so nothing is orphaned and nothing is silently dropped.
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

if (!(await columns("User")).includes("club")) {
  console.log("Already merged: there's no club column left. Nothing to do.");
  process.exit(0);
}

// --- 1. one account per address -------------------------------------------

const dupes = await client.execute(
  `SELECT "email" FROM "User" GROUP BY "email" HAVING COUNT(*) > 1`
);

if (dupes.rows.length === 0) {
  console.log("No address is held twice. Nothing to merge.");
}

for (const { email } of dupes.rows) {
  const rows = (
    await client.execute({
      sql: `SELECT "id", "club", "role", "createdAt" FROM "User"
            WHERE "email" = ? ORDER BY "createdAt" ASC, "id" ASC`,
      args: [email],
    })
  ).rows;

  const [keeper, ...losers] = rows;
  console.log(`\n${email}: ${rows.length} accounts, keeping the ${keeper.club} one`);

  for (const loser of losers) {
    // Everything that points at a user, moved across. Participation is the
    // awkward one: (activityId, userId) is unique, so where the keeper is
    // already on a meetup the loser's row is dropped rather than moved.
    await client.execute({
      sql: `DELETE FROM "Participation" WHERE "userId" = ? AND "activityId" IN
            (SELECT "activityId" FROM "Participation" WHERE "userId" = ?)`,
      args: [loser.id, keeper.id],
    });

    for (const [table, column] of [
      ["RunActivity", "hostId"],
      ["Participation", "userId"],
      ["Comment", "authorId"],
      ["Report", "reporterId"],
      ["Report", "reportedUserId"],
      ["XrpPayment", "userId"],
      ["User", "invitedById"],
    ]) {
      const moved = await client.execute({
        sql: `UPDATE "${table}" SET "${column}" = ? WHERE "${column}" = ?`,
        args: [keeper.id, loser.id],
      });
      if (moved.rowsAffected > 0) {
        console.log(`  moved ${moved.rowsAffected} ${table}.${column}`);
      }
    }

    // One row per user each, and the keeper already has whatever matters.
    for (const table of ["VerificationRequest", "EmailVerification"]) {
      await client.execute({
        sql: `DELETE FROM "${table}" WHERE "userId" = ?`,
        args: [loser.id],
      });
    }

    await client.execute({ sql: `DELETE FROM "User" WHERE "id" = ?`, args: [loser.id] });
    console.log(`  deleted the ${loser.club} duplicate`);
  }
}

// --- 2. one member number each --------------------------------------------

// Numbers restarted per club, so both sides have a #1. The earliest
// account keeps the number it's been showing on its profile; anyone
// clashing with it moves to the end of the roll rather than shuffling
// everybody.
const clashes = await client.execute(
  `SELECT "memberNumber" FROM "User" WHERE "memberNumber" IS NOT NULL
   GROUP BY "memberNumber" HAVING COUNT(*) > 1`
);

for (const { memberNumber } of clashes.rows) {
  const rows = (
    await client.execute({
      sql: `SELECT "id", "email" FROM "User" WHERE "memberNumber" = ?
            ORDER BY "createdAt" ASC, "id" ASC`,
      args: [memberNumber],
    })
  ).rows;

  for (const row of rows.slice(1)) {
    const highest = await client.execute(`SELECT MAX("memberNumber") AS max FROM "User"`);
    const next = (highest.rows[0]?.max ?? 0) + 1;
    await client.execute({
      sql: `UPDATE "User" SET "memberNumber" = ? WHERE "id" = ?`,
      args: [next, row.id],
    });
    console.log(`Renumbered ${row.email}: #${memberNumber} was taken, now #${next}`);
  }
}

// --- 3. the indexes -------------------------------------------------------

const userIndexes = await indexes("User");

if (userIndexes.includes("User_email_key")) {
  console.log("Email index is already global, skipping.");
} else {
  console.log("Putting the email index back to global...");
  if (userIndexes.includes("User_club_email_key")) {
    await client.execute('DROP INDEX "User_club_email_key"');
  }
  await client.execute('CREATE UNIQUE INDEX "User_email_key" ON "User"("email")');
}

if (userIndexes.includes("User_memberNumber_key")) {
  console.log("Member-number index is already global, skipping.");
} else {
  console.log("Putting the member-number index back to global...");
  if (userIndexes.includes("User_club_memberNumber_key")) {
    await client.execute('DROP INDEX "User_club_memberNumber_key"');
  }
  await client.execute('CREATE UNIQUE INDEX "User_memberNumber_key" ON "User"("memberNumber")');
}

// --- 4. the column -------------------------------------------------------

// Last, because SQLite won't drop a column an index still refers to.
for (const table of ["User", "RunActivity"]) {
  if ((await columns(table)).includes("club")) {
    console.log(`Dropping "club" from ${table}...`);
    await client.execute(`ALTER TABLE "${table}" DROP COLUMN "club"`);
  }
}

const total = await client.execute(`SELECT COUNT(*) AS n FROM "User"`);
const meetups = await client.execute(`SELECT COUNT(*) AS n FROM "RunActivity"`);
console.log(`\nOne club now: ${total.rows[0].n} members, ${meetups.rows[0].n} meetups.`);
console.log("Done.");
