// The map style on its own, full screen, for preview pictures.
import { Map, setWorkerUrl } from "maplibre-gl";
import { MAP_STYLE, mapImage } from "../../src/lib/map-style";

setWorkerUrl("/worker.js");
const [lat, lng, zoom] = location.hash.slice(1).split(",").map(Number);
const map = new Map({ container: "map", style: MAP_STYLE, center: [lng, lat], zoom, attributionControl: false });
map.on("styleimagemissing", (e) => mapImage(map, e.id));
map.on("idle", () => (document.title = "idle"));
