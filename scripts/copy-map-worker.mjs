// Copies MapLibre's worker, the part that reads map tiles in the
// background, into public/ for every build. The map tells MapLibre to load
// it from there (src/components/ActivitiesMap.tsx): MapLibre works out its
// worker's address from where its own code was loaded, and once bundled
// that address is wrong, so the map would never draw.
import { copyFile } from "fs/promises";

await copyFile("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/maplibre-worker.js");
console.log("Copied MapLibre's worker to public/maplibre-worker.js");
