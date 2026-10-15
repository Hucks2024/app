// One-off: how quick the live app is, and where the time goes. Public
// pages only; nothing personal is read or printed. The database is only
// asked "SELECT 1", to time the trip to it.
import { chromium } from "playwright";

const BASE = "https://www.packmates.live";
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1 PackmatesApp/1.0";
const ms = (t) => `${Math.round(t)}ms`;
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

// Where this runner is.
const trace = await (await fetch("https://www.cloudflare.com/cdn-cgi/trace")).text();
console.log("runner near Cloudflare", trace.match(/colo=(\w+)/)?.[1]);

// The database: which region its address names, and how long a trip takes.
const db = new URL(process.env.TURSO_DATABASE_URL.replace(/^libsql:/, "https:"));
console.log("database address ends", db.hostname.split(".").slice(1).join("."));
const dbTimes = [];
for (let i = 0; i < 6; i++) {
  const t = performance.now();
  const r = await fetch(`${db.origin}/v2/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.TURSO_AUTH_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [{ type: "execute", stmt: { sql: "SELECT 1" } }, { type: "close" }] }),
  });
  await r.text();
  dbTimes.push(performance.now() - t);
}
console.log("database trips from here:", dbTimes.map(ms).join(" "), "(first includes connecting)");

// Pages, straight requests: until the whole page has arrived (pages
// stream, so the first byte comes before the database has answered).
for (const path of ["/robots.txt", "/terms", "/info", "/login", "/"]) {
  const times = [];
  let colo = "", cache = "";
  for (let i = 0; i < 6; i++) {
    const t = performance.now();
    const r = await fetch(BASE + path, { headers: { "User-Agent": UA } });
    await r.arrayBuffer();
    times.push(performance.now() - t);
    colo = r.headers.get("cf-ray")?.split("-")[1] ?? "";
    cache = r.headers.get("x-nextjs-cache") ?? r.headers.get("cf-cache-status") ?? "";
  }
  console.log(`${path.padEnd(12)} first ${ms(times[0])}, then ${times.slice(1).map(ms).join(" ")}, median ${ms(median(times.slice(1)))}  (Cloudflare ${colo}${cache ? ", cache " + cache : ""})`);
}

// The front page in a phone-sized browser, with its map.
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await b.newContext({ userAgent: UA, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const started = Date.now();
const res = [];
p.on("requestfinished", async (req) => {
  const t = req.timing();
  const size = (await req.sizes().catch(() => null))?.responseBodySize ?? 0;
  res.push({ url: req.url(), at: Date.now() - started, took: t.responseEnd, size });
});
await p.goto(BASE + "/", { waitUntil: "load" });
const nav = await p.evaluate(() => { const n = performance.getEntriesByType("navigation")[0]; return { ttfb: n.responseStart, dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd }; });
await p.waitForTimeout(10000);
const host = (u) => new URL(u).hostname;
const tiles = res.filter((r) => host(r.url) === "tiles.openfreemap.org");
console.log(`front page: first byte ${ms(nav.ttfb)}, ready ${ms(nav.dcl)}, loaded ${ms(nav.load)}`);
console.log(`map files from OpenFreeMap: ${tiles.length}, first done at ${tiles.length ? ms(Math.min(...tiles.map((r) => r.at))) : "-"}, last at ${tiles.length ? ms(Math.max(...tiles.map((r) => r.at))) : "-"}, each took median ${tiles.length ? ms(median(tiles.map((r) => r.took))) : "-"}`);
const ours = res.filter((r) => host(r.url) === "www.packmates.live");
console.log(`own files: ${ours.length}, ${(ours.reduce((s, r) => s + r.size, 0) / 1024).toFixed(0)} KB (JS ${(ours.filter((r) => r.url.endsWith(".js")).reduce((s, r) => s + r.size, 0) / 1024).toFixed(0)} KB)`);
console.log("slowest files:");
for (const r of [...res].sort((x, y) => y.took - x.took).slice(0, 8)) console.log(`  ${ms(r.took).padStart(7)}  ${(r.size / 1024).toFixed(0).padStart(5)} KB  ${r.url.replace(/\?.*/, "").slice(0, 90)}`);

// Going between pages inside the app, as a tap would.
for (const [from, link] of [["/", "/info"], ["/info", "/login"]]) {
  await p.goto(BASE + from, { waitUntil: "networkidle" }).catch(() => {});
  const t = Date.now();
  await p.locator(`a[href="${link}"]:visible`).first().click();
  await p.waitForURL(BASE + link);
  await p.waitForLoadState("networkidle").catch(() => {});
  console.log(`tap ${from} -> ${link}: ${ms(Date.now() - t)}`);
}
await b.close();
