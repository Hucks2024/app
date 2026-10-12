// One-off: App Store screenshots (iPhone 6.9", 1320 x 2868) of the app as
// it looks inside the iPhone app, with the fictional demo meetups.
import { chromium } from "playwright";
import { SignJWT } from "jose";
import { createClient } from "@libsql/client";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3100";
const OUT = process.env.OUT;
mkdirSync(OUT, { recursive: true });
const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
const token = (userId) => new SignJWT({ userId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").sign(secret);
const db = createClient({ url: process.env.DATABASE_URL });

// The meetup to show: one coming up, seen by someone who isn't going yet.
const meetup = "demo-hampstead-ponds";
const going = (await db.execute({ sql: `SELECT userId FROM "Participation" WHERE activityId = ?`, args: [meetup] })).rows.map((r) => r.userId);
const host = (await db.execute({ sql: `SELECT hostId FROM "RunActivity" WHERE id = ?`, args: [meetup] })).rows[0].hostId;
const viewer = ["demo-user-tom", "demo-user-sam", "demo-user-priya", "demo-user-ayo", "demo-user-lena"].find((u) => u !== host && !going.includes(u));
console.log("viewer", viewer);

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 PackmatesApp/1.0";
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
async function shot(name, path, signedIn, wait) {
  // A UK phone: dates and times as people here write them.
  const c = await b.newContext({
    userAgent: UA, viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    locale: "en-GB", timezoneId: "Europe/London",
  });
  if (signedIn) await c.addCookies([{ name: "pacemates_session", value: await token(viewer), url: BASE }]);
  const p = await c.newPage();
  await p.goto(BASE + path, { waitUntil: "load" });
  // Any tip over the map, closed, so the map shows.
  const close = p.getByRole("button", { name: "Close" });
  await close.first().waitFor({ timeout: 4000 }).then(() => close.first().click()).catch(() => {});
  await p.waitForTimeout(wait);
  await p.screenshot({ path: `${OUT}/${name}.png` });
  console.log(name, p.url());
  await c.close();
}
await shot("1-welcome", "/", false, 4000);
await shot("2-map", "/", true, 15000);
await shot("3-meetup", `/activities/${meetup}`, true, 6000);
await shot("4-post", "/activities/new", true, 3000);
await b.close();
