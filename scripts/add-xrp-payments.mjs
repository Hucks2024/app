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

if (userColumnNames.includes("xrpDestinationTag")) {
  console.log('"xrpDestinationTag"/"paidUntil" already exist on User, skipping.');
} else {
  console.log("Adding xrpDestinationTag/paidUntil columns to User...");
  await client.execute('ALTER TABLE "User" ADD COLUMN "xrpDestinationTag" INTEGER');
  await client.execute('ALTER TABLE "User" ADD COLUMN "paidUntil" DATETIME');
  // SQLite/libSQL doesn't support "ADD COLUMN ... UNIQUE" directly, a
  // separate unique index does the same job.
  await client.execute(
    'CREATE UNIQUE INDEX "User_xrpDestinationTag_key" ON "User"("xrpDestinationTag")'
  );
  console.log("Done.");
}

const tables = await client.execute(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='XrpPayment'"
);
if (tables.rows.length > 0) {
  console.log('"XrpPayment" table already exists, skipping.');
} else {
  console.log('Creating "XrpPayment" table...');
  await client.execute(`
    CREATE TABLE "XrpPayment" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "txHash" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "amountXrp" REAL NOT NULL,
      "amountGbp" REAL NOT NULL,
      "monthsCredited" INTEGER NOT NULL,
      "ledgerCloseAt" DATETIME NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "XrpPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await client.execute('CREATE UNIQUE INDEX "XrpPayment_txHash_key" ON "XrpPayment"("txHash")');
  console.log("Done.");
}

// Admins bypass the paywall in application code regardless, but give the
// existing admin account a far-future paidUntil too so it reads sensibly
// in the admin dashboard rather than looking unpaid.
await client.execute(
  `UPDATE "User" SET "paidUntil" = '2099-01-01T00:00:00.000Z' WHERE "role" = 'ADMIN' AND ("paidUntil" IS NULL OR "paidUntil" < '2099-01-01T00:00:00.000Z')`
);

const after = await client.execute('PRAGMA table_info("User")');
console.log("User columns now:", after.rows.map((r) => r.name).join(", "));

client.close();
