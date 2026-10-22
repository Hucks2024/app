// One-off: loads the fictional demo meetups (demo.json) into a fresh local
// database, moved forward so they're coming up this week.
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";

const db = createClient({ url: process.env.DATABASE_URL });
const data = JSON.parse(readFileSync(new URL("./demo.json", import.meta.url), "utf8"));
const day = 24 * 60 * 60 * 1000;
const shiftDays = Math.max(0, Math.floor((Date.now() - Date.UTC(2026, 9, 12)) / day));
const DATES = /At$|Until$/;

for (const table of ["User", "RunActivity", "Participation"]) {
  for (const row of data[table]) {
    const cols = Object.keys(row);
    const args = cols.map((c) => {
      const v = row[c];
      if (v && typeof v === "object" && "b64" in v) return Buffer.from(v.b64, "base64");
      if (table === "RunActivity" && DATES.test(c) && typeof v === "string" && shiftDays) {
        return new Date(new Date(v).getTime() + shiftDays * day).toISOString().replace("Z", "+00:00");
      }
      return v;
    });
    await db.execute({ sql: `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`, args });
  }
  console.log(table, data[table].length);
}

// What the demo predates: how long the walks, runs and rides take, and
// who everyone is. Every meetup stays for all, so the whole map shows.
const durations = {
  "demo-serpentine-5k": 30,
  "demo-vicky-park-10k": 60,
  "demo-richmond-loops": 120,
  "demo-hampstead-ponds": 120,
  "demo-greenwich-hills": 45,
  "demo-lido-dip": 45,
};
for (const [id, mins] of Object.entries(durations)) {
  await db.execute({ sql: `UPDATE "RunActivity" SET "durationMins" = ? WHERE id = ?`, args: [mins, id] });
}
const genders = {
  "demo-user-tom": "MALE",
  "demo-user-sam": "MALE",
  "demo-user-ayo": "TREX",
  "demo-user-mira": "FEMALE",
  "demo-user-priya": "FEMALE",
  "demo-user-lena": "FEMALE",
};
for (const [id, gender] of Object.entries(genders)) {
  await db.execute({ sql: `UPDATE "User" SET "gender" = ? WHERE id = ?`, args: [gender, id] });
}
