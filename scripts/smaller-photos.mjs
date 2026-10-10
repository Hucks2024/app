// One-time change for smaller, longer-kept profile photos (see
// prisma/migrations/20261010120000_photo_version). Adds the photoUpdatedAt
// column photo links are versioned by, and shrinks every photo already
// uploaded to the 320px the app now stores. Turso speaks HTTP rather than
// the wire protocol prisma migrate deploy needs, so it's done here. Safe
// to re-run: a photo already that small is left as it is.
//
// Prints counts and sizes only, never who: this repository is public, and
// so are its Actions logs.
import { createClient } from "@libsql/client";
import sharp from "sharp";

const MAX_SIDE = 320;
const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Set TURSO_DATABASE_URL (+ TURSO_AUTH_TOKEN), or DATABASE_URL for a local file.");
  process.exit(1);
}
const client = createClient({
  url,
  authToken: process.env.TURSO_DATABASE_URL ? process.env.TURSO_AUTH_TOKEN : undefined,
});

const cols = (await client.execute(`PRAGMA table_info("User")`)).rows.map((r) => r.name);
if (cols.includes("photoUpdatedAt")) {
  console.log(`"photoUpdatedAt" already exists, skipping.`);
} else {
  await client.execute(`ALTER TABLE "User" ADD COLUMN "photoUpdatedAt" DATETIME`);
  console.log(`Added "photoUpdatedAt" to User.`);
}

const now = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString().replace("Z", "+00:00");
const ids = (await client.execute(`SELECT "id" FROM "User" WHERE "profilePhoto" IS NOT NULL`)).rows.map((r) => r.id);
let before = 0;
let after = 0;
let shrunk = 0;
for (const id of ids) {
  const row = (await client.execute({ sql: `SELECT "profilePhoto" FROM "User" WHERE "id" = ?`, args: [id] })).rows[0];
  const bytes = Buffer.from(row.profilePhoto);
  before += bytes.length;
  let out = bytes;
  try {
    const meta = await sharp(bytes).metadata();
    if (Math.max(meta.width ?? 0, meta.height ?? 0) > MAX_SIDE) {
      out = await sharp(bytes).rotate().resize(MAX_SIDE, MAX_SIDE, { fit: "inside" }).jpeg({ quality: 82 }).toBuffer();
      shrunk += 1;
    }
  } catch {
    // Not something sharp can read: left as it was.
  }
  after += out.length;
  await client.execute({
    sql: `UPDATE "User" SET "profilePhoto" = ?, "profilePhotoType" = CASE WHEN ? THEN 'image/jpeg' ELSE "profilePhotoType" END, "photoUpdatedAt" = COALESCE("photoUpdatedAt", ?) WHERE "id" = ?`,
    args: [out, out !== bytes ? 1 : 0, now, id],
  });
}
const kb = (n) => `${Math.round(n / 1024)} KB`;
console.log(`Photos: ${ids.length}, shrunk ${shrunk}. Total ${kb(before)} -> ${kb(after)}.`);
client.close();
