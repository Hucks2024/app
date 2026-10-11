// One-off: opens the Cloudflare copy of the app in a real phone-sized
// browser, before packmates.live moves to it. Public pages only; nothing
// personal is read or printed, and the test address isn't printed either.
import { chromium } from "playwright";

const BASE = process.env.BASE;
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
let fails = 0;
const ok = (label, pass, extra = "") => {
  if (!pass) fails++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`);
};
const get = (path, ua = UA) => fetch(BASE + path, { redirect: "manual", headers: { "User-Agent": ua } });

// Pages and rules, straight requests.
const home = await get("/");
const html = await home.text();
ok("front page opens", home.status === 200, String(home.status));
ok("...and it's the app", html.includes("A free map of meetups"));
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
await p.getByRole("button", { name: /Continue with email/ }).click();
ok("sign in screen works", await p.locator("#signin-email").isVisible());
ok("no page errors", errors.length === 0, JSON.stringify(errors));
await b.close();
console.log(fails ? `${fails} FAILED` : "ALL PASSED");
process.exit(fails ? 1 : 0);
