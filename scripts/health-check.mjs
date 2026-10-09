// A read-only look at how the live app is doing: members, meetups, and
// whether email is actually going out.
//
// Counts and dates only. Never a name or an email address: this
// repository is public, and so are its Actions logs.
//
// Email can't be tested from here (the key lives in Vercel); the app only
// sends password reset codes, and a code is only recorded once its email
// has gone (and is deleted once used), so this can only count the ones
// still waiting.
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Set TURSO_DATABASE_URL (+ TURSO_AUTH_TOKEN), or DATABASE_URL for a local file.");
  process.exit(1);
}
const client = createClient({
  url,
  authToken: process.env.TURSO_DATABASE_URL ? process.env.TURSO_AUTH_TOKEN : undefined,
});

const day = 24 * 60 * 60 * 1000;
const now = Date.now();
const when = (v) => (v == null ? null : new Date(typeof v === "number" ? v : String(v)).getTime());
const ago = (t) => {
  const days = Math.floor((now - t) / day);
  return days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
};

const users = (
  await client.execute(`SELECT "createdAt", "emailVerifiedAt", "accountStatus" FROM "User" WHERE "id" NOT LIKE 'demo-%'`)
).rows.map((r) => ({ created: when(r.createdAt), confirmed: when(r.emailVerifiedAt), status: r.accountStatus }));

const recent = users.filter((u) => u.created && now - u.created < 30 * day);
const codes = (await client.execute(`SELECT "sentAt" FROM "EmailVerification"`)).rows.map((r) => when(r.sentAt)).filter(Boolean);
const lastCode = Math.max(0, ...codes);

const meetups = (
  await client.execute(`SELECT "startsAt", "cancelledAt" FROM "RunActivity" WHERE "id" NOT LIKE 'demo-%'`)
).rows.map((r) => ({ starts: when(r.startsAt), cancelled: r.cancelledAt != null }));
const upcoming = meetups.filter((m) => !m.cancelled && m.starts > now);

// Where the domains point, and whether they open the app.
async function dns(name, type) {
  try {
    const res = await fetch(`https://dns.google/resolve?name=${name}&type=${type}`, { signal: AbortSignal.timeout(8000) });
    const json = await res.json();
    return (json.Answer ?? []).map((a) => String(a.data).replace(/\.$/, ""));
  } catch {
    return [];
  }
}
// What the domain's registry holds: the truth, while DNS answers above can
// still be old copies for a few hours after a change.
async function registry(name) {
  try {
    const res = await fetch(`https://rdap.org/domain/${name}`, { signal: AbortSignal.timeout(10000) });
    const json = await res.json();
    return (json.nameservers ?? []).map((n) => String(n.ldhName).toLowerCase());
  } catch {
    return [];
  }
}
async function opens(url) {
  try {
    // As a browser: the app turns away anything that looks like a script.
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) PackmatesHealthCheck" },
      signal: AbortSignal.timeout(10000),
    });
    const where = res.headers.get("location");
    if (where) return `${res.status} -> ${where}`;
    const html = await res.text();
    // The app's own description, which a registrar's holding page won't have.
    return `${res.status}${html.includes("A free map of meetups") ? ", the app" : ", not the app (something else answers)"}`;
  } catch (e) {
    return `doesn't open (${e.cause?.code ?? e.message})`;
  }
}
console.log("");
console.log("DOMAINS");
for (const domain of ["packmates.live", "doyoulikepizza.com"]) {
  const ns = await dns(domain, "NS");
  console.log(`  ${domain}`);
  console.log(`    DNS run by: ${ns.length ? ns.join(", ") : "nothing found"}`);
  const reg = await registry(domain);
  console.log(`    Registry says: ${reg.length ? reg.join(", ") : "couldn't ask"}`);
  const ips = await dns(domain, "A");
  console.log(`    Points at: ${ips.length ? ips.join(", ") : "nothing"}`);
  console.log(`    https://${domain} -> ${await opens(`https://${domain}/`)}`);
}

console.log("");
console.log("MEMBERS");
console.log(`  ${users.length} in all, ${recent.length} joined in the last 30 days`);
console.log(`  ${users.filter((u) => u.status === "BANNED").length} banned`);
console.log("");
console.log("MEETUPS");
console.log(`  ${upcoming.length} coming up, ${meetups.length} ever posted`);
console.log("");
console.log("EMAIL (only used for password resets)");
console.log(`  Reset codes sent and not used yet: ${codes.length}${lastCode ? ` (latest ${ago(lastCode)})` : ""}`);
console.log("  To check email works: /admin -> Email -> Send me a test email.");
