import type { ExpressionSpecification, StyleSpecification } from "maplibre-gl";

// Packmates' own map: bright, simple and a bit like a game board. Grassy
// land, sky-blue water, chunky white roads with violet edges, golden
// motorways, and only the names that help you find your way: no road
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

const MOTORWAY = ["motorway", "trunk"];
const MAJOR = ["primary", "secondary", "tertiary"];
const MINOR = ["minor", "service"];

const roadLine = { "line-cap": "round", "line-join": "round" } as const;

export const MAP_STYLE: StyleSpecification = {
  version: 8,
  name: "Packmates",
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    [SOURCE]: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
  },
  layers: [
    { id: "land", type: "background", paint: { "background-color": "#ddf4cf" } },

    // Fields, woods and towns.
    {
      id: "landcover",
      type: "fill",
      source: SOURCE,
      "source-layer": "landcover",
      paint: {
        "fill-color": [
          "match",
          ["get", "class"],
          "wood", "#9cdb88",
          "grass", "#bfeaa6",
          "farmland", "#d1f0bd",
          "wetland", "#c9eedb",
          "sand", "#fbefc2",
          "ice", "#ffffff",
          "#d1f0bd",
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
          ["residential", "suburb", "neighbourhood"], "#f3eefe",
          ["commercial", "retail", "industrial"], "#ece3fc",
          ["school", "college", "university", "hospital"], "#fde6f1",
          ["cemetery"], "#c6eab6",
          ["stadium", "pitch", "playground"], "#93dc85",
          "#f3eefe",
        ],
      },
    },
    {
      id: "parks",
      type: "fill",
      source: SOURCE,
      "source-layer": "park",
      paint: { "fill-color": "#93db80", "fill-outline-color": "#78cd66" },
    },

    // Water.
    {
      id: "water",
      type: "fill",
      source: SOURCE,
      "source-layer": "water",
      paint: { "fill-color": "#6fd2f6" },
    },
    {
      id: "water-edge",
      type: "line",
      source: SOURCE,
      "source-layer": "water",
      minzoom: 11,
      paint: { "line-color": "#46b9e8", "line-width": grow([11, 0.5], [16, 2]) },
    },
    {
      id: "rivers",
      type: "line",
      source: SOURCE,
      "source-layer": "waterway",
      layout: roadLine,
      paint: {
        "line-color": "#6fd2f6",
        // Rivers wide, streams thin. (The zoom has to come first here.)
        "line-width": [
          "interpolate", ["exponential", 1.5], ["zoom"],
          8, ["match", ["get", "class"], "river", 1, 0],
          12, ["match", ["get", "class"], "river", 3, 0.5],
          16, ["match", ["get", "class"], "river", 10, 3],
        ],
      },
    },

    // Buildings, close up: lavender blocks that look raised, each one a
    // pale top over a darker copy nudged down and right, like a game board.
    {
      id: "building-sides",
      type: "fill",
      source: SOURCE,
      "source-layer": "building",
      minzoom: 14,
      paint: {
        "fill-color": "#b7a3ee",
        "fill-translate": [3, 3],
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
        "fill-color": "#efe8ff",
        "fill-outline-color": "#c9b8f6",
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
      paint: { "line-color": "#b9a3f0", "line-width": grow([14, 1], [18, 3]), "line-dasharray": [1.5, 1.5] },
    },
    {
      id: "rail",
      type: "line",
      source: SOURCE,
      "source-layer": "transportation",
      minzoom: 12,
      filter: is("class", ["rail", "transit"]),
      paint: { "line-color": "#c3b6e6", "line-width": grow([12, 1], [18, 3]), "line-dasharray": [3, 2] },
    },
    {
      id: "minor-edge",
      type: "line",
      source: SOURCE,
      "source-layer": "transportation",
      minzoom: 12,
      filter: is("class", MINOR),
      layout: roadLine,
      paint: { "line-color": "#d8cdf8", "line-width": grow([12, 0.6], [14, 4], [16, 11], [18, 28]) },
    },
    {
      id: "major-edge",
      type: "line",
      source: SOURCE,
      "source-layer": "transportation",
      minzoom: 8,
      filter: is("class", MAJOR),
      layout: roadLine,
      paint: { "line-color": "#c2aef4", "line-width": grow([8, 0.6], [10, 2], [12, 4], [14, 8], [16, 16], [18, 36]) },
    },
    {
      id: "motorway-edge",
      type: "line",
      source: SOURCE,
      "source-layer": "transportation",
      minzoom: 5,
      filter: is("class", MOTORWAY),
      layout: roadLine,
      paint: { "line-color": "#f2a23a", "line-width": grow([5, 0.6], [8, 2], [10, 3], [12, 5], [14, 9], [16, 18], [18, 38]) },
    },
    {
      id: "minor",
      type: "line",
      source: SOURCE,
      "source-layer": "transportation",
      minzoom: 13,
      filter: is("class", MINOR),
      layout: roadLine,
      paint: { "line-color": "#ffffff", "line-width": grow([13, 1], [14, 2.6], [16, 8], [18, 24]) },
    },
    {
      id: "major",
      type: "line",
      source: SOURCE,
      "source-layer": "transportation",
      minzoom: 8,
      filter: is("class", MAJOR),
      layout: roadLine,
      paint: { "line-color": "#ffffff", "line-width": grow([8, 0.3], [10, 1.2], [12, 2.8], [14, 6], [16, 13], [18, 31]) },
    },
    {
      id: "motorway",
      type: "line",
      source: SOURCE,
      "source-layer": "transportation",
      minzoom: 5,
      filter: is("class", MOTORWAY),
      layout: roadLine,
      paint: { "line-color": "#ffd768", "line-width": grow([5, 0.3], [8, 1.2], [10, 2], [12, 3.6], [14, 7], [16, 15], [18, 34]) },
    },

    // Names: rivers, then streets close up, then places.
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
      paint: { "text-color": "#1688bd", "text-halo-color": "#e9f9ff", "text-halo-width": 1.5 },
    },
    {
      id: "street-names",
      type: "symbol",
      source: SOURCE,
      "source-layer": "transportation_name",
      minzoom: 15,
      filter: is("class", [...MAJOR, ...MINOR]),
      layout: {
        "symbol-placement": "line",
        "text-field": NAME,
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 15, 11, 18, 14],
      },
      paint: { "text-color": "#6a54b8", "text-halo-color": "#ffffff", "text-halo-width": 1.5 },
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
      paint: { "text-color": "#7c5ad6", "text-halo-color": "#ffffff", "text-halo-width": 2 },
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
      paint: { "text-color": "#4c30a8", "text-halo-color": "#ffffff", "text-halo-width": 2 },
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
      paint: { "text-color": "#3b1d8f", "text-halo-color": "#ffffff", "text-halo-width": 2.5 },
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
      paint: { "text-color": "#2e1065", "text-halo-color": "#ffffff", "text-halo-width": 3 },
    },
  ],
};

/** The credits the map's licence asks for, shown behind the ⓘ button. */
export const MAP_CREDITS =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> · ' +
  '<a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">© OpenMapTiles</a> · ' +
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>';
