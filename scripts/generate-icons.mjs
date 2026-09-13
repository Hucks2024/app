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

/** @param inset 0 fills the tile; higher values pull the mark in, which is
 *  what a maskable icon needs so a circular crop can't clip it. */
function markSvg(size, inset) {
  const scale = 1 - inset;
  const shift = (512 * inset) / 2;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
       <rect width="512" height="512" fill="${BRAND}"/>
       <g transform="translate(${shift} ${shift}) scale(${scale})">
         <path d="${PIN_PATH}" fill="#fff"/>
         ${person(256, 236, 0.62, BRAND)}
         ${person(186, 250, 0.48, BRAND)}
         ${person(326, 250, 0.48, BRAND)}
       </g>
     </svg>`
  );
}

async function write(size, inset, out) {
  await sharp(markSvg(size, inset)).png().toFile(out);
  console.log(`  ${out}`);
}

await mkdir("public", { recursive: true });

console.log("Generating icons...");
await write(192, 0.04, "public/icon-192.png");
await write(512, 0.04, "public/icon-512.png");
await write(180, 0.04, "src/app/apple-icon.png");
await write(96, 0.02, "src/app/icon.png");
// Android can crop this to a circle, so the pin sits well inside.
await write(512, 0.3, "public/icon-maskable-512.png");
console.log("Done.");
