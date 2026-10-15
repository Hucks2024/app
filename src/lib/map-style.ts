import type { ExpressionSpecification, LayerSpecification, Map as MapLibreMap, StyleSpecification } from "maplibre-gl";

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
const TRUNK = ["trunk"];
const PRIMARY = ["primary"];
const SECONDARY = ["secondary", "tertiary"];
const MINOR = ["minor", "service"];

const roadLine = { "line-cap": "round", "line-join": "round" } as const;

/** One kind of road: its edge or its middle, drawn as a line that grows
 * with the zoom. */
const road = (id: string, classes: string[], minzoom: number, color: string, width: ExpressionSpecification): LayerSpecification => ({
  id,
  type: "line",
  source: SOURCE,
  "source-layer": "transportation",
  minzoom,
  filter: is("class", classes),
  layout: roadLine,
  paint: { "line-color": color, "line-width": width },
});

// The places people meet, as emoji in a coloured bubble: what each looks
// like, which OpenStreetMap places it's for (by class, or by subclass
// where the class is too broad), and how close in it shows. Parks first,
// since "meet at the park gates" is half of all meetups; restaurants and
// takeaways only right up close, or they'd bury everything else.
const BUBBLE = { green: "#d6f5c4", food: "#ffe2c2", fun: "#e9ddff", travel: "#d3e9ff", sport: "#fff0b3" };
const TEXT = { green: "#2d8a3e", food: "#b4531d", fun: "#6d4fc2", travel: "#2b6fb0", sport: "#8a6a00" };
type Kind = { emoji: string; look: keyof typeof BUBBLE; classes?: string[]; subclasses?: string[]; from: 13 | 14 | 16 };
const KINDS: Kind[] = [
  { emoji: "🌳", look: "green", classes: ["park"], from: 13 },
  { emoji: "☕", look: "food", classes: ["cafe"], from: 14 },
  { emoji: "🍺", look: "food", classes: ["beer"], subclasses: ["pub"], from: 14 },
  { emoji: "🍸", look: "food", classes: ["bar"], from: 14 },
  { emoji: "🚉", look: "travel", subclasses: ["station", "halt"], from: 14 },
  { emoji: "🚇", look: "travel", subclasses: ["subway"], from: 14 },
  { emoji: "🎬", look: "fun", classes: ["cinema"], from: 14 },
  { emoji: "🎭", look: "fun", classes: ["theatre"], from: 14 },
  { emoji: "🎨", look: "fun", classes: ["art_gallery"], from: 14 },
  { emoji: "🏛️", look: "fun", classes: ["museum"], from: 14 },
  { emoji: "🏰", look: "fun", classes: ["castle"], from: 14 },
  { emoji: "🦁", look: "fun", classes: ["zoo"], from: 14 },
  { emoji: "🏟️", look: "sport", classes: ["stadium"], from: 14 },
  { emoji: "🏊", look: "sport", classes: ["swimming"], subclasses: ["swimming_pool"], from: 14 },
  { emoji: "💪", look: "sport", subclasses: ["fitness_centre"], from: 14 },
  { emoji: "⚽", look: "sport", subclasses: ["pitch"], from: 16 },
  { emoji: "🍽️", look: "food", classes: ["restaurant"], from: 16 },
  { emoji: "🍔", look: "food", classes: ["fast_food"], from: 16 },
  { emoji: "🍦", look: "food", classes: ["ice_cream"], from: 16 },
  { emoji: "📚", look: "fun", classes: ["library"], from: 16 },
];
const pairs = (key: "classes" | "subclasses") => KINDS.flatMap((k) => (k[key] ?? []).map((c) => [c, k.emoji]));
/** A place's emoji, or "" for one that doesn't get one. */
const EMOJI = [
  "match", ["get", "subclass"], ...pairs("subclasses").flat(),
  ["match", ["get", "class"], ...pairs("classes").flat(), ""],
] as unknown as ExpressionSpecification;
const EMOJI_PREFIX = "emoji:";
const lookOf = (emoji: string) => KINDS.find((k) => k.emoji === emoji)?.look;

/** The bubbles that show from one zoom in. Park names always; every other
 * name only right up close, where there's room for them. */
const places = (id: string, from: Kind["from"]): LayerSpecification => ({
  id,
  type: "symbol",
  source: SOURCE,
  "source-layer": "poi",
  minzoom: from,
  filter: ["match", EMOJI, KINDS.filter((k) => k.from === from).map((k) => k.emoji), true, false],
  layout: {
    "icon-image": ["concat", EMOJI_PREFIX, EMOJI],
    "symbol-sort-key": ["get", "rank"],
    "text-field": ["step", ["zoom"], ["case", ["==", ["get", "class"], "park"], NAME, ""], 17, NAME],
    "text-font": ["Noto Sans Bold"],
    "text-size": 12,
    "text-max-width": 8,
    "text-anchor": "top",
    "text-offset": [0, 1.4],
    "text-optional": true,
  },
  paint: {
    "text-color": [
      "match", EMOJI,
      ...KINDS.flatMap((k) => [k.emoji, TEXT[k.look]]),
      "#5d5668",
    ] as ExpressionSpecification,
    "text-halo-color": "#ffffff",
    "text-halo-width": 1.5,
  },
});

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
      paint: { "line-color": "#d9c19b", "line-width": grow([14, 0.8], [18, 2]), "line-dasharray": [2, 1.5] },
    },
    {
      id: "rail",
      type: "line",
      source: SOURCE,
      "source-layer": "transportation",
      minzoom: 11,
      filter: is("class", ["rail", "transit"]),
      paint: { "line-color": "#cbc4d6", "line-width": grow([11, 1], [18, 2.5]), "line-dasharray": [3, 2] },
    },
    road("minor-edge", MINOR, 13, "#e3dbcf", grow([13, 1.5], [14, 4], [16, 11], [18, 28])),
    road("secondary-edge", SECONDARY, 10, "#ddd0ba", grow([10, 1.4], [12, 3.4], [14, 7], [16, 15], [18, 34])),
    road("primary-edge", PRIMARY, 8, "#ead08a", grow([8, 0.9], [10, 2.4], [12, 4.4], [14, 8.5], [16, 16], [18, 36])),
    road("trunk-edge", TRUNK, 6, "#e6bb4e", grow([6, 0.7], [8, 1.6], [10, 3], [12, 5], [14, 9], [16, 17], [18, 38])),
    road("motorway-edge", MOTORWAY, 5, "#e8953a", grow([5, 1], [8, 2.6], [10, 3.8], [12, 6], [14, 10], [16, 19], [18, 40])),
    road("minor", MINOR, 13, "#ffffff", grow([13, 0.8], [14, 2.6], [16, 8], [18, 24])),
    road("secondary", SECONDARY, 10, "#ffffff", grow([10, 0.7], [12, 2], [14, 5], [16, 12], [18, 30])),
    road("primary", PRIMARY, 8, "#fff3b8", grow([8, 0.5], [10, 1.4], [12, 3], [14, 6.5], [16, 13.5], [18, 33])),
    road("trunk", TRUNK, 6, "#ffdf73", grow([6, 0.4], [8, 1], [10, 1.8], [12, 3.4], [14, 7], [16, 14], [18, 34])),
    road("motorway", MOTORWAY, 5, "#ffbf5e", grow([5, 0.5], [8, 1.5], [10, 2.4], [12, 4.2], [14, 8], [16, 16], [18, 36])),

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
      filter: is("class", [...TRUNK, ...PRIMARY, ...SECONDARY, ...MINOR]),
      layout: {
        "symbol-placement": "line",
        "text-field": NAME,
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 15, 11, 18, 14],
      },
      paint: { "text-color": "#5d5668", "text-halo-color": "#ffffff", "text-halo-width": 1.5 },
    },

    // The places people meet (KINDS, above).
    places("parks-places", 13),
    places("places", 14),
    places("places-close", 16),
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
  const emoji = id.slice(EMOJI_PREFIX.length);
  const look = lookOf(emoji);
  if (!look) return;
  const ratio = 2;
  const size = 32 * ratio;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const middle = size / 2;
  const radius = middle - 3 * ratio;
  // A white ring with a soft shadow, filled with the kind's colour.
  ctx.shadowColor = "rgba(46, 16, 101, 0.3)";
  ctx.shadowBlur = 3 * ratio;
  ctx.shadowOffsetY = ratio;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(middle, middle, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = BUBBLE[look];
  ctx.beginPath();
  ctx.arc(middle, middle, radius - 2 * ratio, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `${16 * ratio}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#000000";
  ctx.fillText(emoji, middle, middle + ratio);
  map.addImage(id, ctx.getImageData(0, 0, size, size), { pixelRatio: ratio });
}

/** The credits the map's licence asks for, shown behind the ⓘ button. */
export const MAP_CREDITS =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> · ' +
  '<a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">© OpenMapTiles</a> · ' +
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>';
