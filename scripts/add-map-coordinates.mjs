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

if (columnNames.includes("latitude")) {
  console.log('"latitude"/"longitude" already exist on RunActivity — skipping.');
} else {
  console.log('Adding "latitude"/"longitude" columns to RunActivity...');
  await client.execute('ALTER TABLE "RunActivity" ADD COLUMN "latitude" REAL');
  await client.execute('ALTER TABLE "RunActivity" ADD COLUMN "longitude" REAL');
  console.log("Done.");
}

const after = await client.execute('PRAGMA table_info("RunActivity")');
console.log(
  "RunActivity columns now:",
  after.rows.map((r) => r.name).join(", ")
);

client.close();
