import fs from "fs";
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN");
  process.exit(1);
}

const client = createClient({ url, authToken });

const existing = await client
  .execute("SELECT name FROM sqlite_master WHERE type='table' AND name='User'")
  .catch(() => ({ rows: [] }));

if (existing.rows.length > 0) {
  console.log("Tables already exist on this Turso database — skipping schema setup.");
} else {
  const sql = fs.readFileSync(new URL("./turso-setup.sql", import.meta.url), "utf-8");
  console.log(`Applying schema (${sql.length} bytes)...`);
  await client.executeMultiple(sql);
  console.log("Schema applied.");
}

const tables = await client.execute(
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
);
console.log("Tables now present:", tables.rows.map((r) => r.name).join(", "));

const admin = await client.execute(
  "SELECT email, role FROM \"User\" WHERE email = 'admin@doyoulikepizza.com'"
);
console.log("Admin account:", admin.rows.length > 0 ? "present" : "MISSING");

client.close();
