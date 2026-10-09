// A read-only look at how the live app is doing: members, meetups, and
// whether email is actually going out.
//
// Counts and dates only. Never a name or an email address: this
// repository is public, and so are its Actions logs.
//
// Email can't be tested from here (the key lives in Vercel), but the
// database shows what happened: a sign-up code is only recorded once the
// email has actually gone, and someone who typed one in confirmed their
// address some seconds after joining. Anyone confirmed in the same moment
// they joined got in without a code, because email was off or failing.
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
const withCode = recent.filter((u) => u.confirmed && u.confirmed - u.created > 10_000);
const waiting = recent.filter((u) => !u.confirmed);
const noCode = recent.filter((u) => u.confirmed && u.confirmed - u.created <= 10_000);

const codes = (await client.execute(`SELECT "sentAt" FROM "EmailVerification"`)).rows.map((r) => when(r.sentAt)).filter(Boolean);
const lastCode = Math.max(0, ...codes, ...withCode.map((u) => u.confirmed));

const meetups = (
  await client.execute(`SELECT "startsAt", "cancelledAt" FROM "RunActivity" WHERE "id" NOT LIKE 'demo-%'`)
).rows.map((r) => ({ starts: when(r.startsAt), cancelled: r.cancelledAt != null }));
const upcoming = meetups.filter((m) => !m.cancelled && m.starts > now);

let reminders = 0;
try {
  const rows = (await client.execute(`SELECT "reminderSentAt" FROM "Participation" WHERE "reminderSentAt" IS NOT NULL`)).rows;
  reminders = rows.map((r) => when(r.reminderSentAt)).filter((t) => t && now - t < 7 * day).length;
} catch {
  // Older database without the column: nothing sent yet.
}

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
async function opens(url) {
  try {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10000) });
    const where = res.headers.get("location");
    if (where) return `${res.status} -> ${where}`;
    const html = await res.text();
    return `${res.status}${/packmates/i.test(html) ? ", the app" : ", not the app"}`;
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
console.log("EMAIL (people who joined in the last 30 days)");
console.log(`  ${withCode.length} got a code by email and typed it in`);
console.log(`  ${waiting.length} got a code and haven't typed it in yet`);
console.log(`  ${noCode.length} got in without a code (email was off or failing then)`);
console.log(`  Last code sent: ${lastCode ? ago(lastCode) : "never"}`);
console.log(`  Reminder emails sent in the last 7 days: ${reminders}`);
console.log("");
if (recent.length === 0) {
  console.log("VERDICT: nobody has joined in 30 days, so there's nothing to tell from. Use the Email steps at the top of /admin.");
} else if (withCode.length + waiting.length > 0 && (noCode.length === 0 || lastCode > Math.max(...noCode.map((u) => u.created)))) {
  console.log("VERDICT: email is working. New members get their code.");
} else if (withCode.length + waiting.length > 0) {
  console.log("VERDICT: email worked for some and failed for others. Follow the Email steps at the top of /admin.");
} else {
  console.log("VERDICT: no code has gone out. Email is switched off or failing. Follow the Email steps at the top of /admin.");
}
