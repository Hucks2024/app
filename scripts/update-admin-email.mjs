import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
const newEmail = process.env.NEW_EMAIL;
if (!url || !authToken || !newEmail) {
  console.error("Missing TURSO_DATABASE_URL / TURSO_AUTH_TOKEN / NEW_EMAIL");
  process.exit(1);
}

const client = createClient({ url, authToken });

const result = await client.execute({
  sql: "UPDATE \"User\" SET email = ? WHERE role = 'ADMIN'",
  args: [newEmail],
});
console.log("Rows updated:", result.rowsAffected);

const check = await client.execute({
  sql: "SELECT id, email, role FROM \"User\" WHERE role = 'ADMIN'",
  args: [],
});
console.log("Admin account(s) now:", JSON.stringify(check.rows));

client.close();
