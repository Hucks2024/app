// One-off: moving the live database to a new place (Tokyo to Europe), in
// steps run by hand from .github/workflows/db-move.yml:
//
//   backup   Everything in the database: its tables, indexes and every
//            row, photos too. Encrypted, kept as the run's artifact for a
//            week, and first rehearsed: restored into a scratch database
//            on the runner and checked row for row.
//   restore  Into the empty database the secrets now point at, from a
//            backup run's artifact, then checked row for row against it.
//   where    Which region the database is in and how many rows each table
//            has. Nothing else.
//
// The repository is public, and so are these logs and the artifact. Only
// counts, table names and the region are ever printed, and the backup is
// encrypted (AES-256-GCM) with a key made from the CLOUDFLARE_API_TOKEN
// secret, which only runs in this repository can read.
import { createClient } from "@libsql/client";
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const FILE = new URL("./backup.enc", import.meta.url);
const step = process.argv[2];

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

/** Over HTTPS, the way the app itself talks to Turso. */
function connect(url, authToken) {
  if (!url) fail("No database address (TURSO_DATABASE_URL).");
  return createClient({ url: url.replace(/^libsql:/, "https:"), authToken, intMode: "bigint" });
}

/** "aws-eu-west-1", from the address; never the database's own name. */
function region(url) {
  if (url.startsWith("file:")) return "a file on this runner";
  return new URL(url.replace(/^libsql:/, "https:")).hostname.split(".").slice(1, -2).join(".") || "unknown";
}

// Our own tables, not SQLite's or Turso's bookkeeping.
const OURS = "name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream%' AND name NOT LIKE 'libsql_%'";

/** A cell as JSON can carry it exactly: whole numbers as text, bytes as
 * base64. */
function pack(v) {
  if (v === null || typeof v === "string") return v;
  if (typeof v === "bigint") return { i: v.toString() };
  if (typeof v === "number") return Number.isFinite(v) ? v : { f: String(v) };
  if (v instanceof ArrayBuffer) return { b: Buffer.from(v).toString("base64") };
  if (ArrayBuffer.isView(v)) return { b: Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString("base64") };
  fail(`A cell of a kind this doesn't know (${typeof v}).`);
}
function unpack(v) {
  if (v === null || typeof v !== "object") return v;
  if ("i" in v) return BigInt(v.i);
  if ("f" in v) return Number(v.f);
  return new Uint8Array(Buffer.from(v.b, "base64"));
}

/** A table's rows, order aside, as one hash: the same rows give the same
 * fingerprint wherever they're stored. */
function fingerprint(rows) {
  const lines = rows.map((r) => JSON.stringify(r)).sort();
  const h = createHash("sha256");
  for (const line of lines) h.update(line).update("\n");
  return h.digest("hex");
}

async function readAll(db) {
  const schema = (
    await db.execute(`SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL AND ${OURS} ORDER BY rowid`)
  ).rows.map((r) => ({ type: r.type, name: r.name, sql: r.sql }));
  const tables = {};
  for (const { name } of schema.filter((s) => s.type === "table")) {
    const rs = await db.execute(`SELECT * FROM "${name.replace(/"/g, '""')}"`);
    const rows = rs.rows.map((row) => rs.columns.map((_, i) => pack(row[i])));
    tables[name] = { columns: rs.columns, rows, count: rows.length, fingerprint: fingerprint(rows) };
  }
  let sequences = [];
  try {
    sequences = (await db.execute("SELECT name, seq FROM sqlite_sequence")).rows.map((r) => ({ name: r.name, seq: pack(r.seq) }));
  } catch {
    // No AUTOINCREMENT tables, so no sqlite_sequence.
  }
  return { schema, tables, sequences };
}

function show(tables) {
  for (const [name, t] of Object.entries(tables)) console.log(`  ${name.padEnd(24)} ${String(t.count).padStart(6)} rows`);
}

function key() {
  const source = process.env.BACKUP_KEY_SOURCE;
  if (!source) fail("No key to lock the backup with (the CLOUDFLARE_API_TOKEN secret).");
  return Buffer.from(hkdfSync("sha256", source, "packmates-db-move", "backup v1", 32));
}

function seal(data) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(gzipSync(Buffer.from(JSON.stringify(data)))), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}
function open(sealed) {
  const decipher = createDecipheriv("aes-256-gcm", key(), sealed.subarray(0, 12));
  decipher.setAuthTag(sealed.subarray(12, 28));
  try {
    return JSON.parse(gunzipSync(Buffer.concat([decipher.update(sealed.subarray(28)), decipher.final()])).toString());
  } catch {
    fail("The backup won't open: it's damaged, or locked with a different key.");
  }
}

/** Statements in chunks of about a megabyte, each one request, with the
 * foreign key checks off (rows go in table by table, not in the order the
 * links between them need). */
async function run(db, stmts) {
  let chunk = [];
  let size = 0;
  const flush = async () => {
    if (chunk.length) await db.migrate(chunk);
    chunk = [];
    size = 0;
  };
  for (const s of stmts) {
    chunk.push(s);
    size += JSON.stringify(s.args ?? [], (_, v) => (typeof v === "bigint" ? v.toString() : v instanceof Uint8Array ? "x".repeat(v.length * 2) : v)).length + s.sql.length;
    if (size > 1_000_000 || chunk.length >= 500) await flush();
  }
  await flush();
}

async function restoreInto(db, backup) {
  const existing = Number((await db.execute(`SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND ${OURS}`)).rows[0].n);
  if (existing > 0) fail("That database already has tables in it. It has to be a new, empty one: nothing was changed.");

  const order = { table: 0, index: 1, view: 2, trigger: 3 };
  const ddl = [...backup.schema].sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9)).map((s) => ({ sql: s.sql, args: [] }));
  const q = (n) => `"${n.replace(/"/g, '""')}"`;
  const tables = backup.schema.filter((s) => s.type === "table").map((s) => s.name);
  // Tables first, rows next, then the indexes and triggers over them.
  await run(db, ddl.filter((_, i) => i < tables.length));
  const inserts = [];
  for (const name of tables) {
    const t = backup.tables[name];
    const sql = `INSERT INTO ${q(name)} (${t.columns.map(q).join(", ")}) VALUES (${t.columns.map(() => "?").join(", ")})`;
    for (const row of t.rows) inserts.push({ sql, args: row.map(unpack) });
  }
  await run(db, inserts);
  await run(db, ddl.filter((_, i) => i >= tables.length));
  if (backup.sequences.length) {
    await run(
      db,
      backup.sequences.flatMap(({ name, seq }) => [
        { sql: "INSERT INTO sqlite_sequence (name, seq) SELECT ?, 0 WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = ?)", args: [name, name] },
        { sql: "UPDATE sqlite_sequence SET seq = ? WHERE name = ?", args: [unpack(seq), name] },
      ])
    );
  }
}

/** Every table, row for row, the same as the backup. */
async function check(db, backup) {
  const now = await readAll(db);
  let ok = true;
  for (const [name, t] of Object.entries(backup.tables)) {
    const got = now.tables[name];
    const same = got && got.count === t.count && got.fingerprint === t.fingerprint;
    if (!same) ok = false;
    console.log(`  ${same ? "✓" : "✗"} ${name.padEnd(24)} ${String(got?.count ?? 0).padStart(6)} of ${t.count} rows${same ? "" : ", NOT the same"}`);
  }
  const want = backup.schema.map((s) => `${s.type} ${s.name}`).sort().join("\n");
  const have = now.schema.map((s) => `${s.type} ${s.name}`).sort().join("\n");
  if (want !== have) {
    ok = false;
    console.log("  ✗ The tables and indexes don't match the backup's.");
  } else console.log(`  ✓ All ${backup.schema.length} tables and indexes`);
  return ok;
}

const url = process.env.TURSO_DATABASE_URL ?? "";

if (step === "where") {
  const db = connect(url, process.env.TURSO_AUTH_TOKEN);
  console.log(`Database in: ${region(url)}`);
  show((await readAll(db)).tables);
} else if (step === "backup") {
  const db = connect(url, process.env.TURSO_AUTH_TOKEN);
  console.log(`Backing up the database in: ${region(url)}`);
  const data = await readAll(db);
  const backup = { made: new Date().toISOString(), from: region(url), ...data };
  show(backup.tables);
  writeFileSync(FILE, seal(backup));

  // The rehearsal: the file as saved, opened and restored into a scratch
  // database here, and checked.
  console.log("\nRehearsing the restore from the saved file:");
  const scratch = new URL("./rehearsal.db", import.meta.url);
  rmSync(scratch, { force: true });
  const local = createClient({ url: `file:${scratch.pathname}`, intMode: "bigint" });
  const reopened = open(readFileSync(FILE));
  await restoreInto(local, reopened);
  const ok = await check(local, reopened);
  local.close();
  rmSync(scratch, { force: true });
  if (!ok) fail("The rehearsal didn't match. Don't delete anything.");
  console.log(`\n✓ Backup made and checked: ${Object.values(backup.tables).reduce((n, t) => n + t.count, 0)} rows in ${Object.keys(backup.tables).length} tables.`);
} else if (step === "restore") {
  if (!existsSync(FILE)) fail("No backup file here: give the backup run's number.");
  const backup = open(readFileSync(FILE));
  console.log(`Backup made ${backup.made}, from ${backup.from}.`);
  console.log(`Restoring into the database in: ${region(url)}`);
  if (region(url) === backup.from) console.log("(Same region as the backup came from.)");
  const db = connect(url, process.env.TURSO_AUTH_TOKEN);
  await restoreInto(db, backup);
  console.log("\nChecking it against the backup:");
  if (!(await check(db, backup))) fail("The restored database doesn't match the backup.");
  console.log(`\n✓ Everything is in the new database and matches the backup.`);
} else {
  fail(`Unknown step "${step}": backup, restore or where.`);
}
