// One-off: opens the live app, now on Cloudflare, in a real phone-sized
// browser. Public pages only; nothing personal is read or printed.
import { chromium } from "playwright";

const BASE = process.env.BASE;
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
let fails = 0;
const ok = (label, pass, extra = "") => {
  if (!pass) fails++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`);
  // A failure as a GitHub note too, readable without the full log.
  if (!pass) console.log(`::error::${label}${extra ? "  " + extra : ""}`.replace(/\r?\n/g, " "));
};
const get = (path, ua = UA) => fetch(BASE + path, { redirect: "manual", headers: { "User-Agent": ua } });

// Pages and rules, straight requests.
const home = await get("/");
const html = await home.text();
ok("front page opens", home.status === 200, String(home.status));
ok("...served by Cloudflare", home.headers.get("x-opennext") === "1" && /cloudflare/i.test(home.headers.get("server") ?? ""), home.headers.get("server"));
const apex = await fetch("https://packmates.live/terms?x=1", { redirect: "manual", headers: { "User-Agent": UA } });
ok("packmates.live goes to www", apex.status === 308 && apex.headers.get("location") === "https://www.packmates.live/terms?x=1", `${apex.status} ${apex.headers.get("location")}`);
ok("...and it's the app", html.includes("A free map of meetups"));
ok("...with Sign up at the top", html.includes(">Sign up</a>"));
ok("...with the new heading", html.includes("find your people<"));
ok("...with no tracking script added by Cloudflare", !html.includes("cloudflareinsights"));
ok("...with the security rules", (home.headers.get("content-security-policy") ?? "").includes("frame-ancestors 'none'"));
for (const path of ["/terms", "/privacy", "/info", "/login", "/robots.txt", "/manifest.webmanifest"]) {
  const r = await get(path);
  ok(`${path} opens`, r.status === 200, String(r.status));
}
const prof = await get("/profile");
ok("Me sends you to sign in", [302, 303, 307, 308].includes(prof.status) && (prof.headers.get("location") ?? "").includes("/login?next=%2Fprofile"), `${prof.status} ${prof.headers.get("location")}`);
ok("photos are members-only", (await get("/api/photos/profile/anyone")).status === 401);
ok("bots turned away", (await get("/", "curl/8.0")).status === 403);
const worker = await get("/maplibre-worker.js");
ok("map worker kept by phones", (worker.headers.get("cache-control") ?? "").includes("immutable"), worker.headers.get("cache-control"));
const chunk = html.match(/\/_next\/static\/[^"']+\.js/)?.[0];
const js = chunk ? await get(chunk) : null;
ok("app files kept by phones", (js?.headers.get("cache-control") ?? "").includes("immutable"), js?.headers.get("cache-control"));

// How quick: the front page five times, after the first.
const times = [];
for (let i = 0; i < 5; i++) {
  const t = Date.now();
  await (await get("/")).text();
  times.push(Date.now() - t);
}
console.log(`  front page took ${times.join(", ")} ms`);

// The map, in a real browser.
process.on("uncaughtException", (e) => {
  console.log(`::error::Crashed: ${String(e?.message ?? e).split("\n")[0].slice(0, 300)}`);
  process.exit(1);
});
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await (await b.newContext({ userAgent: UA, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
const errors = [];
let tiles = 0;
p.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
p.on("console", (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) errors.push(m.text().slice(0, 200)); });
p.on("response", (r) => { if (r.url().includes("tiles.openfreemap.org") && r.ok()) tiles++; });
await p.goto(BASE + "/", { waitUntil: "load" });
await p.waitForTimeout(12000);
ok("map draws from OpenFreeMap", tiles > 0 && (await p.locator("canvas").count()) > 0, `${tiles} tile responses`);
await p.goto(BASE + "/login", { waitUntil: "load" });
// With no Apple or Google sign in set up, it starts at the email box.
const email = p.getByRole("button", { name: /Continue with email/ });
if (await email.isVisible()) await email.click();
ok("sign in screen works", await p.locator("#signin-email").isVisible());
// Joining's "are you a person?" (Cloudflare Turnstile, src/lib/turnstile.ts):
// switched on, and Cloudflare happy to show it on this site. A made-up
// address goes as far as the join form and no further, so no account is
// made and nothing is sent.
let challenge = 0;
p.on("request", (r) => { if (r.url().startsWith("https://challenges.cloudflare.com/")) challenge++; });
await p.locator("#signin-email").fill(`check-${Date.now()}@example.com`);
await p.getByRole("button", { name: "Continue" }).click();
await p.locator("#signin-name").waitFor({ timeout: 15000 });
await p.waitForTimeout(8000);
ok("join form loads Cloudflare's person check", challenge > 0, `${challenge} requests`);
ok("...and its answer box is in the form", (await p.locator('form input[name="cf-turnstile-response"]').count()) === 1);
ok("no page errors", errors.length === 0, JSON.stringify(errors));
await b.close();
console.log(fails ? `${fails} FAILED` : "ALL PASSED");
process.exit(fails ? 1 : 0);
