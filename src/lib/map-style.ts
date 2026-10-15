import type { ExpressionSpecification, Map as MapLibreMap, StyleSpecification } from "maplibre-gl";

// Packmates' own map: laid out like the maps everyone already knows (pale
// land, green parks, blue water, yellow main roads, orange motorways), so
// nothing needs working out, with the fun in the details: bright colours,
// buildings that look raised, and emoji for the places people meet once
// you're close enough to see them (☕ cafés, 🍺 pubs, 🌳 parks). No road
// numbers, shop icons or bus stops. The streets themselves are
// OpenStreetMap's, served free by OpenFreeMap; the look is ours.

const SOURCE = "openfreemap";
export const MAP_SOURCE_ID = SOURCE;

// Names in English where OpenStreetMap has one, otherwise as written there.
const NAME: ExpressionSpecification = ["coalesce", ["get", "name:en"], ["get", "name:latin"], ["get", "name"]];

const is = (field: string, values: string[]): ExpressionSpecification => ["match", ["get", field], values, true, false];

/** A width that grows with the zoom, from [zoom, width] pairs. */
const grow = (...stops: [number, number][]): ExpressionSpecification =>
  ["interpolate", ["exponential", 1.5], ["zoom"], ...stops.flat()] as ExpressionSpecification;

const MOTORWAY = ["motorway"];
const MAIN = ["trunk", "primary"];
const SECONDARY = ["secondary", "tertiary"];
const MINOR = ["minor", "service"];

const roadLine = { "line-cap": "round", "line-join": "round" } as const;

/** The emoji for a place, or "" for one not worth a picture. Stations by
 * kind first, then everything else by what it is. */
const PLACE_EMOJI: ExpressionSpecification = [
  "match",
  ["get", "subclass"],
  ["station", "halt"], "🚉",
  "subway", "🚇",
  "pub", "🍺",
  "fitness_centre", "💪",
  "pitch", "⚽",
  "swimming_pool", "🏊",
  [
    "match",
    ["get", "class"],
    "cafe", "☕",
    "beer", "🍺",
    "bar", "🍸",
    "restaurant", "🍽️",
    "fast_food", "🍔",
    "ice_cream", "🍦",
    "park", "🌳",
    "stadium", "🏟️",
    "swimming", "🏊",
    "zoo", "🦁",
    "library", "📚",
    "cinema", "🎬",
    "theatre", "🎭",
    "art_gallery", "🎨",
    "museum", "🏛️",
    "castle", "🏰",
    "",
  ],
];
const EMOJI_PREFIX = "emoji:";

export const MAP_STYLE: StyleSpecification = {
  version: 8,
  name: "Packmates",
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    [SOURCE]: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
  },
  layers: [
    { id: "land", type: "background", paint: { "background-color": "#f8f4ec" } },

    // Woods and fields: green where it's green, and farmland left as land,
    // the way paper maps do it.
    {
      id: "landcover",
      type: "fill",
      source: SOURCE,
      "source-layer": "landcover",
      filter: is("class", ["wood", "grass", "wetland", "sand", "ice"]),
      paint: {
        "fill-color": [
          "match",
          ["get", "class"],
          "wood", "#a9e293",
          "grass", "#c8efb1",
          "wetland", "#cdeedf",
          "sand", "#fbefc4",
          "#ffffff",
        ],
      },
    },
    {
      id: "towns",
      type: "fill",
      source: SOURCE,
      "source-layer": "landuse",
      paint: {
        "fill-color": [
          "match",
          ["get", "class"],
          ["residential", "suburb", "neighbourhood"], "#f2ede4",
          ["commercial", "retail"], "#f9ebe6",
          ["industrial"], "#eeebf3",
          ["school", "college", "university"], "#f8efd6",
          ["hospital"], "#fde4e6",
          ["cemetery"], "#d5edc6",
          ["stadium", "pitch", "playground"], "#b9e99d",
          "#f2ede4",
        ],
      },
    },
    {
      id: "parks",
      type: "fill",
      source: SOURCE,
      "source-layer": "park",
      paint: { "fill-color": "#b2e799", "fill-outline-color": "#98da7c" },
    },

    // Water.
    {
      id: "water",
      type: "fill",
      source: SOURCE,
      "source-layer": "water",
      paint: { "fill-color": "#8dd3ff" },
    },
    {
      id: "water-edge",
      type: "line",
      source: SOURCE,
      "source-layer": "water",
      minzoom: 11,
      paint: { "line-color": "#62bff2", "line-width": grow([11, 0.5], [16, 1.5]) },
    },
    {
      id: "rivers",
      type: "line",
      source: SOURCE,
      "source-layer": "waterway",
      layout: roadLine,
      paint: {
        "line-color": "#8dd3ff",
        // Rivers wide, streams thin. (The zoom has to come first here.)
        "line-width": [
          "interpolate", ["exponential", 1.5], ["zoom"],
          8, ["match", ["get", "class"], "river", 1, 0],
          12, ["match", ["get", "class"], "river", 3, 0.5],
          16, ["match", ["get", "class"], "river", 10, 3],
        ],
      },
    },

    // Buildings, close up: each one a pale top over a darker copy nudged
    // down and right, so the streets look like a little model town.
    {
      id: "building-sides",
      type: "fill",
      source: SOURCE,
      "source-layer": "building",
      minzoom: 14,
      paint: {
        "fill-color": "#d9cfe9",
        "fill-translate": [2, 2],
        "fill-translate-anchor": "viewport",
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, 1],
      },
    },
    {
      id: "buildings",
      type: "fill",
      source: SOURCE,
      "source-layer": "building",
      minzoom: 14,
      paint: {
        "fill-color": "#efebf5",
        "fill-outline-color": "#d6cbe8",
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, 1],
      },
    },

    // Roads: edges first, then the road on top, so junctions join up.
    {
      id: "paths",
      type: "line",
      source: SOURCE,
      "source-layer": "transportation",
      minzoom: 14,
      filter: is("class", ["path", "track"]),
      layout: roadLine,
      paint: { "line-color": "#c9a979", "line-width": grow([14, 1], [18, 2.5]), "line-dasharray": [2, 1.5] },
    },
    {
      id: "rail",
      type: "line",
      source: SOURCE,
      "source-layer": "transportation",
      minzoom: 11,
      filter: is("class", ["rail", "transit"]),
      paint: { "line-color": "#bdb6c9", "line-width": grow([11, 1], [18, 3]), "line-dasharray": [3, 2] },
    },
    {
      id: "minor-edge",
      type: "line",
      source: SOURCE,
      "source-layer": "transportation",
      minzoom: 13,
      filter: is("class", MINOR),
      layout: roadLine,
      paint: { "line-color": "#e3dbcf", "line-width": grow([13, 1.5], [14, 4], [16, 11], [18, 28]) },
    },
    {
      id: "secondary-edge",
      type: "line",
      source: SOURCE,
      "source-layer": "transportation",
      minzoom: 10,
      filter: is("class", SECONDARY),
      layout: roadLine,
      paint: { "line-color": "#dccfb9", "line-width": grow([10, 1.5], [12, 3.5], [14, 7], [16, 15], [18, 34]) },
    },
    {
      id: "main-edge",
      type: "line",
      source: SOURCE,
      "source-layer": "transportation",
      minzoom: 6,
      filter: is("class", MAIN),
      layout: roadLine,
      paint: { "line-color": "#e8bf55", "line-width": grow([6, 0.8], [8, 1.8], [10, 3], [12, 5], [14, 9], [16, 17], [18, 38]) },
    },
    {
      id: "motorway-edge",
      type: "line",
      source: SOURCE,
      "source-layer": "transportation",
      minzoom: 5,
      filter: is("class", MOTORWAY),
      layout: roadLine,
      paint: { "line-color": "#e8933a", "line-width": grow([5, 1], [8, 2.6], [10, 3.8], [12, 6], [14, 10], [16, 19], [18, 40]) },
    },
    {
      id: "minor",
      type: "line",
      source: SOURCE,
      "source-layer": "transportation",
      minzoom: 13,
      filter: is("class", MINOR),
      layout: roadLine,
      paint: { "line-color": "#ffffff", "line-width": grow([13, 0.8], [14, 2.6], [16, 8], [18, 24]) },
    },
    {
      id: "secondary",
      type: "line",
      source: SOURCE,
      "source-layer": "transportation",
      minzoom: 10,
      filter: is("class", SECONDARY),
      layout: roadLine,
      paint: { "line-color": "#ffffff", "line-width": grow([10, 0.8], [12, 2.2], [14, 5], [16, 12], [18, 30]) },
    },
    {
      id: "main",
      type: "line",
      source: SOURCE,
      "source-layer": "transportation",
      minzoom: 6,
      filter: is("class", MAIN),
      layout: roadLine,
      paint: { "line-color": "#ffe27a", "line-width": grow([6, 0.4], [8, 1], [10, 1.8], [12, 3.4], [14, 7], [16, 14], [18, 34]) },
    },
    {
      id: "motorway",
      type: "line",
      source: SOURCE,
      "source-layer": "transportation",
      minzoom: 5,
      filter: is("class", MOTORWAY),
      layout: roadLine,
      paint: { "line-color": "#ffb653", "line-width": grow([5, 0.5], [8, 1.5], [10, 2.4], [12, 4.2], [14, 8], [16, 16], [18, 36]) },
    },

    // Names: water, then streets close up, then places.
    {
      id: "river-names",
      type: "symbol",
      source: SOURCE,
      "source-layer": "waterway",
      minzoom: 12,
      filter: is("class", ["river"]),
      layout: {
        "symbol-placement": "line",
        "text-field": NAME,
        "text-font": ["Noto Sans Italic"],
        "text-size": 13,
      },
      paint: { "text-color": "#2a86c0", "text-halo-color": "#effaff", "text-halo-width": 1.5 },
    },
    {
      id: "lake-names",
      type: "symbol",
      source: SOURCE,
      "source-layer": "water_name",
      minzoom: 12,
      filter: ["==", ["geometry-type"], "Point"],
      layout: {
        "text-field": NAME,
        "text-font": ["Noto Sans Italic"],
        "text-size": 13,
        "text-max-width": 7,
      },
      paint: { "text-color": "#2a86c0", "text-halo-color": "#effaff", "text-halo-width": 1.5 },
    },
    {
      id: "street-names",
      type: "symbol",
      source: SOURCE,
      "source-layer": "transportation_name",
      minzoom: 15,
      filter: is("class", [...MAIN, ...SECONDARY, ...MINOR]),
      layout: {
        "symbol-placement": "line",
        "text-field": NAME,
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 15, 11, 18, 14],
      },
      paint: { "text-color": "#5d5668", "text-halo-color": "#ffffff", "text-halo-width": 1.5 },
    },

    // The places people meet, as emoji in a white bubble, drawn on the
    // phone the first time each one is needed (mapIcon, below). Park names
    // from the start, since "meet at the park gates" is half of all
    // meetups; everywhere else's name only right up close.
    {
      id: "places",
      type: "symbol",
      source: SOURCE,
      "source-layer": "poi",
      minzoom: 15,
      filter: ["!=", PLACE_EMOJI, ""],
      layout: {
        "icon-image": ["concat", EMOJI_PREFIX, PLACE_EMOJI],
        "symbol-sort-key": ["get", "rank"],
        "text-field": ["step", ["zoom"], ["case", ["==", ["get", "class"], "park"], NAME, ""], 17, NAME],
        "text-font": ["Noto Sans Bold"],
        "text-size": 12,
        "text-max-width": 8,
        "text-anchor": "top",
        "text-offset": [0, 1.3],
        "text-optional": true,
      },
      paint: {
        "text-color": ["match", ["get", "class"], "park", "#2d8a3e", ["cafe", "beer", "bar", "restaurant", "fast_food", "ice_cream"], "#b4531d", "#5d5668"],
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.5,
      },
    },
    {
      id: "neighbourhoods",
      type: "symbol",
      source: SOURCE,
      "source-layer": "place",
      minzoom: 11,
      maxzoom: 17,
      filter: is("class", ["suburb", "quarter", "neighbourhood"]),
      layout: {
        "text-field": NAME,
        "text-font": ["Noto Sans Bold"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 11, 10, 15, 13],
        "text-transform": "uppercase",
        "text-letter-spacing": 0.08,
        "text-max-width": 8,
      },
      paint: { "text-color": "#8b7fae", "text-halo-color": "#ffffff", "text-halo-width": 2 },
    },
    {
      id: "villages",
      type: "symbol",
      source: SOURCE,
      "source-layer": "place",
      minzoom: 10,
      maxzoom: 16,
      filter: is("class", ["village", "hamlet"]),
      layout: {
        "text-field": NAME,
        "text-font": ["Noto Sans Bold"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 10, 12, 15, 15],
        "text-max-width": 8,
      },
      paint: { "text-color": "#4a4458", "text-halo-color": "#ffffff", "text-halo-width": 2 },
    },
    {
      id: "towns-names",
      type: "symbol",
      source: SOURCE,
      "source-layer": "place",
      minzoom: 7,
      maxzoom: 15,
      filter: is("class", ["town"]),
      layout: {
        "text-field": NAME,
        "text-font": ["Noto Sans Bold"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 7, 12, 14, 18],
        "text-max-width": 8,
      },
      paint: { "text-color": "#3a3448", "text-halo-color": "#ffffff", "text-halo-width": 2.5 },
    },
    {
      id: "cities",
      type: "symbol",
      source: SOURCE,
      "source-layer": "place",
      maxzoom: 14,
      filter: is("class", ["city"]),
      layout: {
        "text-field": NAME,
        "text-font": ["Noto Sans Bold"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 4, 13, 12, 26],
        "text-max-width": 8,
      },
      paint: { "text-color": "#2a2438", "text-halo-color": "#ffffff", "text-halo-width": 3 },
    },
  ],
};

/** Draws a place's emoji bubble the first time the map asks for it (its
 * "styleimagemissing" event), with the phone's own emoji, so they look
 * like the ones in its messages. Anything else it asks for is left be. */
export function mapIcon(map: MapLibreMap, id: string) {
  if (!id.startsWith(EMOJI_PREFIX) || map.hasImage(id)) return;
  const ratio = 2;
  const size = 26 * ratio;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const middle = size / 2;
  ctx.shadowColor = "rgba(46, 16, 101, 0.28)";
  ctx.shadowBlur = 3 * ratio;
  ctx.shadowOffsetY = ratio;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(middle, middle, middle - 3 * ratio, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.font = `${13 * ratio}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(id.slice(EMOJI_PREFIX.length), middle, middle + ratio);
  map.addImage(id, ctx.getImageData(0, 0, size, size), { pixelRatio: ratio });
}

/** The credits the map's licence asks for, shown behind the ⓘ button. */
export const MAP_CREDITS =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> · ' +
  '<a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">© OpenMapTiles</a> · ' +
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>';
