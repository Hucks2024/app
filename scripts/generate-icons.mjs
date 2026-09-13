import sharp from "sharp";
import { mkdir } from "fs/promises";

// Builds the home-screen icons from the same runner the nav uses, so the
// installed app and the site share a mark.
//
// Run with `node scripts/generate-icons.mjs`; the PNGs it writes are
// committed. Deliberately not a build step: it needs a colour emoji font
// installed locally, which a deploy image can't be relied on to have.
//
// Noto Color Emoji renders here as a flat silhouette rather than the full
// colour glyph, which is lucky, a solid shape is exactly what an icon
// wants. It gets recoloured white and set on the app's purple-to-magenta
// gradient.

const GRADIENT_STOPS = [
  { offset: "0%", color: "#6d28d9" },
  { offset: "45%", color: "#9333ea" },
  { offset: "75%", color: "#c026d3" },
  { offset: "100%", color: "#db2777" },
];

function backgroundSvg(size) {
  const stops = GRADIENT_STOPS.map(
    (s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`
  ).join("");
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
       <defs><linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1">${stops}</linearGradient></defs>
       <rect width="${size}" height="${size}" fill="url(#g)"/>
     </svg>`
  );
}

/** The runner glyph, trimmed to its own bounds and recoloured white. */
async function whiteRunner() {
  const drawn = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
         <text x="400" y="620" font-size="620" text-anchor="middle"
               font-family="Noto Color Emoji">🏃</text>
       </svg>`
    )
  )
    .png()
    .trim()
    .toBuffer();

  const { width, height } = await sharp(drawn).metadata();
  if (!width || !height) throw new Error("Runner glyph did not render");

  // Keep the glyph's alpha (its shape) and throw away its colour, so the
  // silhouette becomes solid white.
  const alpha = await sharp(drawn).ensureAlpha().extractChannel("alpha").toBuffer();
  return sharp({ create: { width, height, channels: 3, background: "#ffffff" } })
    .joinChannel(alpha)
    .png()
    .toBuffer();
}

/** One icon: white runner centred on the gradient, at `coverage` of the width. */
async function icon(size, coverage, out) {
  const runner = await whiteRunner();
  const target = Math.round(size * coverage);
  const resized = await sharp(runner)
    .resize(target, target, { fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp(backgroundSvg(size))
    .composite([{ input: resized, gravity: "centre" }])
    .png()
    .toFile(out);
  console.log(`  ${out}`);
}

await mkdir("public", { recursive: true });

console.log("Generating icons...");
// Plain icons fill the tile; iOS and Android round the corners themselves.
await icon(192, 0.62, "public/icon-192.png");
await icon(512, 0.62, "public/icon-512.png");
await icon(180, 0.62, "src/app/apple-icon.png");
await icon(96, 0.66, "src/app/icon.png");
// Maskable gets a smaller runner: Android can crop this to a circle, and
// only the middle 80% is guaranteed to survive.
await icon(512, 0.45, "public/icon-maskable-512.png");
console.log("Done.");
