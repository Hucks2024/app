import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN");
  process.exit(1);
}

const client = createClient({ url, authToken });

const columns = await client.execute('PRAGMA table_info("RunActivity")');
const columnNames = columns.rows.map((r) => r.name);

if (columnNames.includes("stravaUrl")) {
  console.log('"stravaUrl" already exists on RunActivity, skipping.');
} else {
  console.log('Adding "stravaUrl" column to RunActivity...');
  await client.execute('ALTER TABLE "RunActivity" ADD COLUMN "stravaUrl" TEXT');
  console.log("Done.");
}

const after = await client.execute('PRAGMA table_info("RunActivity")');
console.log(
  "RunActivity columns now:",
  after.rows.map((r) => r.name).join(", ")
);

client.close();
