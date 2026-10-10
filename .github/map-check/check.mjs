// One-off: opens the live site in a real phone-sized browser and reports
// whether the map is drawn from OpenFreeMap. Counts only, nothing personal.
import { chromium } from "playwright";
import sharp from "sharp";

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const c = await b.newContext({ userAgent: UA, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await c.newPage();
const seen = { openfreemap: 0, openfreemapOk: 0, openstreetmap: 0, worker: [], csp: [], errors: [] };
p.on("response", (r) => {
  const u = r.url();
  if (u.includes("tiles.openfreemap.org")) { seen.openfreemap++; if (r.ok()) seen.openfreemapOk++; }
  if (/tile\.openstreetmap\./.test(u)) seen.openstreetmap++;
  if (u.includes("/maplibre-worker.js")) seen.worker.push(`${r.status()} ${r.headers()["content-type"]}`);
});
p.on("console", (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) seen.csp.push(m.text().slice(0, 200)); });
p.on("pageerror", (e) => seen.errors.push(e.message.slice(0, 200)));
await p.goto("https://www.packmates.live/", { waitUntil: "load" });
const map = p.locator(".leaflet-container").first();
await map.scrollIntoViewIfNeeded();
await p.waitForTimeout(15000);
await map.scrollIntoViewIfNeeded();
const box = await map.boundingBox();
const shot = await p.screenshot({ clip: box });
const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
const colours = new Set();
for (let i = 0; i < data.length; i += info.channels * 7) colours.add((data[i] >> 3) * 1024 + (data[i + 1] >> 3) * 32 + (data[i + 2] >> 3));
console.log("MAP CHECK");
console.log("  MapLibre canvas:", await p.locator(".leaflet-gl-layer canvas, canvas.maplibregl-canvas").count());
console.log("  OpenFreeMap responses:", seen.openfreemap, "ok:", seen.openfreemapOk);
console.log("  OpenStreetMap stand-in tiles:", seen.openstreetmap);
console.log("  worker:", JSON.stringify(seen.worker));
console.log("  credits:", (await p.locator(".leaflet-control-attribution").first().innerText()).replace(/\s+/g, " "));
console.log("  distinct colours in the map:", colours.size, "(a blank map has a handful; a drawn one, hundreds)");
console.log("  security policy complaints:", JSON.stringify(seen.csp));
console.log("  page errors:", JSON.stringify(seen.errors));
await b.close();
