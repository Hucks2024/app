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
 * @param tile false drops the square: the pin stands on its own on a
 *   transparent background. That's the browser-tab version, where a solid
 *   square reads as a sticker and shrinks the mark to make room for its
 *   own padding.
 *
 * The home-screen tile is dark, with the drop in the app's violet-to-pink
 * and the pack in white. iPhones can't be given a separate dark-mode icon
 * for a web app (apple-touch-icon has no dark variant), so the one icon has
 * to sit right among dark icons, and a dark tile with a bright mark also
 * reads well on a light home screen and in iOS's tinted mode, where a
 * light tile turns to grey mush.
 */
function markSvg(size, fill, tile) {
  const scale = (512 * fill) / PIN.height;
  // On the tile: the gradient drop with a white pack. In the tab: the
  // white drop with the violet pack, the same way round as the nav bar.
  const pin = tile ? "url(#drop)" : "#fff";
  const pack = tile ? "#fff" : BRAND;
  // Without the tile, a violet edge gives the white drop its shape. Tabs
  // are light in some browsers and near-black in others: on the dark ones
  // the white carries it, and on the light ones the edge does.
  const edge = tile ? "" : ` stroke="${BRAND}" stroke-width="20" stroke-linejoin="round"`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
       <defs>
         <linearGradient id="tile" x1="0" y1="0" x2="0" y2="1">
           <stop offset="0" stop-color="#2a1f45"/>
           <stop offset="1" stop-color="#0f0b1c"/>
         </linearGradient>
         <linearGradient id="drop" x1="0" y1="0" x2="0" y2="1">
           <stop offset="0" stop-color="#8b5cf6"/>
           <stop offset="0.55" stop-color="#c026d3"/>
           <stop offset="1" stop-color="#ec4899"/>
         </linearGradient>
       </defs>
       ${tile ? `<rect width="512" height="512" fill="url(#tile)"/>` : ""}
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
// Nearly edge to edge, like the big marks on other apps' icons: the round
// top and the point sit clear of iOS's rounded corners, so nothing clips.
await write(192, 0.94, "public/icon-192.png");
await write(512, 0.94, "public/icon-512.png");
await write(180, 0.94, "src/app/apple-icon.png");
// The browser tab: no tile, and the drop nearly the full height of the
// canvas, since there's no square around it that needs a margin.
await write(96, 0.9, "src/app/icon.png", { tile: false });
// Android crops this to whatever shape the launcher uses, and the safe
// zone is the middle 80% as a circle. A drop this tall is 1.22x as wide
// across its diagonal, so 0.58 is what keeps the corners of it inside a
// circular crop; anything near the 0.82 above would lose the tip.
await write(512, 0.58, "public/icon-maskable-512.png");
console.log("Done.");
