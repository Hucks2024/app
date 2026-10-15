// One-off: pictures of the map style at a few places and zooms, from a
// phone-sized window, saved to OUT.
import { createServer } from "node:http";
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.env.OUT;
mkdirSync(OUT, { recursive: true });
const files = {
  "/": ["text/html", `<!doctype html><meta name=viewport content="width=device-width"><link rel=stylesheet href=/map.css><style>html,body,#map{margin:0;height:100%}</style><div id=map></div><script type=module src=/app.js></script>`],
  "/app.js": ["text/javascript", readFileSync("/tmp/preview/app.js")],
  "/map.css": ["text/css", readFileSync("node_modules/maplibre-gl/dist/maplibre-gl.css")],
  "/worker.js": ["text/javascript", readFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs")],
};
const server = createServer((req, res) => {
  const f = files[req.url.split("?")[0]];
  if (!f) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": f[0] }).end(f[1]);
}).listen(8080);

// [name, lat, lng, zoom] (MapLibre zooms: the app's Leaflet zoom minus 1).
const VIEWS = [
  ["1-region", 51.95, -1.05, 8],
  ["2-london", 51.507, -0.11, 10.5],
  ["3-town", 51.52, -0.14, 13.3],
  ["4-streets", 51.5125, -0.127, 14.5],
  ["5-park", 51.535, -0.157, 15],
  ["6-riverside", 51.5055, -0.0865, 15.5],
  ["7-close", 51.5133, -0.1335, 16.3],
  ["8-closest", 51.5145, -0.1318, 17.2],
  ["9-near-me-centre", 51.513, -0.13, 14],
  ["10-near-me-suburb", 51.4618, -0.138, 14],
  ["11-near-me-oxford", 51.752, -1.2577, 14],
];
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
for (const [name, lat, lng, zoom] of VIEWS) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  p.on("pageerror", (e) => console.log(name, "PAGE ERROR", e.message));
  p.on("console", (m) => console.log(name, "console:", m.text()));
  await p.goto(`http://localhost:8080/#${lat},${lng},${zoom}`);
  await p.waitForFunction(() => document.title === "idle", null, { timeout: 60000 }).catch(() => console.log(name, "never idle"));
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/${name}.png` });
  console.log(name, "saved");
  await p.close();
}
await b.close();
server.close();
