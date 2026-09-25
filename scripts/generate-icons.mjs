import sharp from "sharp";
import { mkdir } from "fs/promises";

// Builds the app icons: a map pin with a pack of three inside it. The app
// is a map first, so the mark says both what it does and who it's for.
//
// Run with `node scripts/generate-icons.mjs`; the PNGs it writes are
// committed. Pure SVG with no font dependency, so it's reproducible
// anywhere.
//
// The same shape is drawn in src/components/Logo.tsx for the nav. If you
// change the geometry here, change it there too.

// Must match BRAND in src/components/Logo.tsx: the icon, the nav mark and
// the map pins are all the one violet.
const BRAND = "#6d28d9";

export const PIN_PATH =
  "M256 74 q-120 0 -120 120 q0 90 120 224 q120 -134 120 -224 q0 -120 -120 -120 Z";

/** One figure: circle head over a rounded torso. */
const person = (x, y, s, fill) => `
  <g transform="translate(${x} ${y}) scale(${s})" fill="${fill}">
    <circle cx="0" cy="-78" r="32"/>
    <path d="M0 -34 Q40 -34 44 12 Q48 52 38 66 Q20 74 0 74 Q-20 74 -38 66 Q-48 52 -44 12 Q-40 -34 0 -34 Z"/>
  </g>`;

// Where the drop actually sits inside the 512 canvas. It's a tall, narrow
// shape in a square box: 240 wide and 344 high, centred at (256, 246),
// and the rest of the box is empty.
//
// That emptiness is why scaling the canvas never made the icon look
// bigger. The mark was only ever 47% of the tile's width, so next to
// other apps on a home screen it read as small however the box was
// scaled. Scaling the mark about its own centre is what actually fills
// the tile.
const PIN = { width: 240, height: 344, cx: 256, cy: 246 };

/**
 * @param fill how much of the canvas height the drop should take, 0-1.
 * @param tile false drops the violet square: the pin stands on its own in
 *   the brand colour with the pack in white, on a transparent background.
 *   That's the browser-tab version, where a solid square reads as a
 *   sticker and shrinks the mark to make room for its own padding.
 */
function markSvg(size, fill, tile) {
  const scale = (512 * fill) / PIN.height;
  const pin = tile ? "#fff" : BRAND;
  const pack = tile ? BRAND : "#fff";
  // Tabs are light in some browsers and near-black in others. A thin white
  // edge disappears on the first and keeps a violet drop from sinking
  // into the second.
  const edge = tile ? "" : ` stroke="#fff" stroke-width="14" stroke-linejoin="round"`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
       ${tile ? `<rect width="512" height="512" fill="${BRAND}"/>` : ""}
       <g transform="translate(256 256) scale(${scale}) translate(${-PIN.cx} ${-PIN.cy})">
         <path d="${PIN_PATH}" fill="${pin}"${edge}/>
         ${person(256, 236, 0.62, pack)}
         ${person(186, 250, 0.48, pack)}
         ${person(326, 250, 0.48, pack)}
       </g>
     </svg>`
  );
}

async function write(size, fill, out, { tile = true } = {}) {
  await sharp(markSvg(size, fill, tile)).png().toFile(out);
  console.log(`  ${out}`);
}

await mkdir("public", { recursive: true });

console.log("Generating icons...");
await write(192, 0.82, "public/icon-192.png");
await write(512, 0.82, "public/icon-512.png");
await write(180, 0.82, "src/app/apple-icon.png");
// The browser tab: no tile, and the drop nearly the full height of the
// canvas, since there's no square around it that needs a margin.
await write(96, 0.94, "src/app/icon.png", { tile: false });
// Android crops this to whatever shape the launcher uses, and the safe
// zone is the middle 80% as a circle. A drop this tall is 1.22x as wide
// across its diagonal, so 0.58 is what keeps the corners of it inside a
// circular crop; anything near the 0.82 above would lose the tip.
await write(512, 0.58, "public/icon-maskable-512.png");
console.log("Done.");
