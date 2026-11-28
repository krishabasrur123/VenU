/**
 * The map each venue screen draws its pins on: the venue's own published static map where it has a
 * usable one, hotlinked from its site (never committed), else VenU's schematic drawing.
 * Facility pins (x, y in ./mock.ts) are normalized positions on this image.
 *
 * A venue can have several layers, e.g. SoFi's outside map plus its Level 3 and Level 6 concourse
 * maps: the toggle over the map switches them, and each facility sits on one (`Facility.layer`, the
 * first layer when unset). A layer's `toBase` places it on the first layer, so walks can cross them.
 *
 * Every venue also keeps a link to its interactive map page. That page can't be framed and
 * controlled (it's cross-origin), so it opens in the browser instead.
 *
 * e.g. venueMapFor('sofi')?.image?.url → SoFi's "Parking Zones" map with the numbered entries
 */
import type { MapPoint, MapRect } from './map-geometry';
import type { Facility, Venue, VenueShape } from './types';

export interface VenueMapImage {
  url: string;
  /** Pixel size of the published image, for laying it out before it loads. */
  width: number;
  height: number;
}

/**
 * Where a layer's image sits on the first layer's: base x = a·x + b·y + c, base y = d·x + e·y + f,
 * all normalized (0 to 1). e.g. [0.5, 0, 0.25, 0, 0.5, 0.25] = the middle quarter of the base map.
 */
export type LayerPlacement = [a: number, b: number, c: number, d: number, e: number, f: number];

export interface VenueMapLayer {
  /** Unique within the venue, e.g. 'outside', 'level-3'; facilities name it in `layer`. */
  id: string;
  /** What the toggle says: "Outside", or "Level 3" for `level: 3` (venue:map.layers.*). */
  kind: 'outside' | 'level';
  level?: number;
  image: VenueMapImage;
  /** The part of the layer shown first (normalized). */
  focus: MapRect;
  /** Metres across the image's full width, for walk estimates. */
  widthMeters: number;
  /** Where the image sits on the first layer's; the first layer itself leaves it out. */
  toBase?: LayerPlacement;
  /** Fills the map area around the image when zoomed out. */
  background?: string;
}

export interface VenueMap {
  /** Who made the map, as shown in "Map: <source>". A proper name, so never translated. */
  source: string;
  /** The venue's interactive map page, opened by "Open interactive map"; null hides the link. */
  pageUrl: string | null;
  /** The published image, or null for the schematic drawing of `shape`. With layers: the first's. */
  image: VenueMapImage | null;
  shape: VenueShape;
  /** The part of the map shown first (normalized), before any chip or route. */
  focus: MapRect;
  /** Metres across the image's full width, for walk estimates. */
  widthMeters: number;
  /** The facility a visitor starts from until they tap "I'm here" somewhere: the main way in. */
  arrival: string | null;
  /**
   * The arrival's own name already says it's the main way in ("Main Entrance"), so the route panel
   * says "From Main Entrance." rather than "From Main Entrance, the main way in."
   */
  arrivalNamedMain?: boolean;
  /** Fills the map area around the image when zoomed out, matching the image's own edges. */
  background?: string;
  /**
   * Maps the toggle switches between, the first being this map's own image, focus and width (e.g.
   * outside, then the concourse levels). Without it the venue has one layer and no toggle.
   */
  layers?: VenueMapLayer[];
}

// SoFi's own parking zones map (as of 06.03.25) from sofistadium.com/plan-your-visit/parking-and-
// transportation: the stadium, its numbered entries, the lots and streets, north up. Prairie Ave.
// to Yukon Ave. (about 1 km) spans 45% of its width.
const SOFI_OUTSIDE: VenueMapLayer = {
  id: 'outside',
  kind: 'outside',
  image: { url: 'https://www.sofistadium.com/assets/img/Overall_SoFiStadium_Map_2025-20147a9837.jpg', width: 2550, height: 3300 },
  // The bowl and its twelve entries, from Lot C to Entry 9.
  focus: [0.28, 0.285, 0.56, 0.52],
  widthMeters: 2200,
};

// SoFi's Level 3 and Level 6 concourse maps (Cartifact, as of 09.20.24), on sofistadium.com's own
// asset host like the parking map. No page links them any more (/plan-your-visit/seating-map now
// redirects to the interactive map), so the Wayback Machine's index of sofistadium.com/assets/img
// is where they turned up; both still load from a plain <img> on another site (no hotlink block).
// Each marks elevators, escalators, the ramp, Guest Services, first aid, the sensory rooms (SR),
// restrooms and hydration stations. Their "north" arrow points up, but the field really runs about
// 31° east of north: laying the Level 3 map over the parking map (its VIP Entry 6, 7, 11 and 12
// elevators on those entries, and the bowls' centres together, each within about 50 px) gives the
// placement below, at 0.2996 of the parking map's scale (so 2200 m × 0.2996 ≈ 659 m across).
// Both level maps share one frame: the field sits on the same pixels in each.
const SOFI_LEVEL_PLACEMENT: LayerPlacement = [0.2558, 0.2018, 0.1966, -0.1205, 0.2558, 0.3428];
const sofiLevel = (level: number, url: string): VenueMapLayer => ({
  id: `level-${level}`,
  kind: 'level',
  level,
  image: { url, width: 2550, height: 3300 },
  focus: [0.15, 0.15, 0.85, 0.78], // the concourse ring, without the title and legend
  widthMeters: 659,
  toBase: SOFI_LEVEL_PLACEMENT,
  background: '#ffffff', // the image's white edge
});

const MAPS: Readonly<Record<string, VenueMap>> = {
  sofi: {
    source: 'SoFi Stadium',
    pageUrl: 'https://www.sofistadium.com/plan-your-visit/maps',
    image: SOFI_OUTSIDE.image,
    shape: 'bowl',
    focus: SOFI_OUTSIDE.focus,
    widthMeters: SOFI_OUTSIDE.widthMeters,
    arrival: 'entry-4',
    layers: [
      SOFI_OUTSIDE,
      sofiLevel(3, 'https://www.sofistadium.com/assets/img/Level-3-SoFi-Stadium-F-82c625ccc3.jpg'),
      sofiLevel(6, 'https://www.sofistadium.com/assets/img/Level-6-SoFi-Stadium-F-1331ea6520.jpg'),
    ],
  },
  // Intuit Dome's own site loads its maps from this Adobe publish host; intuitdome.com/content/dam/…
  // answers with an HTML page, not the image. The exterior map shows the plaza, the dome and both
  // garages, north up (Century Blvd. along the top).
  'intuit-dome': {
    source: 'Intuit Dome',
    pageUrl: 'https://www.intuitdome.com/plan-your-visit/venue-map',
    image: {
      url: 'https://publish-p111705-e1087822.adobeaemcloud.com/content/dam/intuit-dome/en/web/content/venue-map/intuit-dome-exterior-venue-map-1920x1080.jpg',
      width: 1920,
      height: 1080,
    },
    shape: 'arena',
    focus: [0.24, 0.46, 0.56, 0.86],
    widthMeters: 900,
    arrival: 'main-entrance',
    arrivalNamedMain: true,
    background: '#101010', // the image's near-black edge
  },
  // Seating blueprint (1425×1104) bundled as a local asset — use the special "local:" prefix so
  // venue-map-view.tsx can resolve it via require() without polluting this plain TS module with
  // a React Native require() call that breaks Jest. North is up (compass shown top-left).
  // Chick Hearn Way runs along the top, Figueroa St. along the bottom-right, Georgia St. to the
  // left. Entrances, Guest Services and restroom icons are labelled on the image itself.
  'crypto-arena': {
    source: 'Crypto.com Arena',
    pageUrl: 'https://visit.cryptoarena.com/map',
    image: {
      url: 'local:crypto-arena-map',
      width: 1425,
      height: 1104,
    },
    shape: 'arena',
    focus: [0.08, 0.04, 0.92, 0.96],
    widthMeters: 260,
    arrival: 'star-plaza-entrance',
  },
};

/** The venue's map; a venue without an entry gets the plain schematic of its shape. */
export function venueMapFor(venue: Pick<Venue, 'id' | 'name' | 'shape'>): VenueMap {
  if (Object.prototype.hasOwnProperty.call(MAPS, venue.id)) return MAPS[venue.id];
  let map = fallbacks.get(venue.id);
  if (!map) {
    map = { source: venue.name, pageUrl: null, image: null, shape: venue.shape, focus: [0, 0, 1, 1], widthMeters: 300, arrival: null };
    fallbacks.set(venue.id, map); // same object every time, so it can sit in hook deps
  }
  return map;
}

const fallbacks = new Map<string, VenueMap>();

/** Venue ids with a map of their own, for tests. */
export function venuesWithMaps(): string[] {
  return Object.keys(MAPS);
}

/** Width over height: the image's, or 1 for the square schematic. */
export function mapAspect(map: Pick<VenueMap, 'image'>): number {
  return map.image ? map.image.width / map.image.height : 1;
}

/** Id of a map without `layers`: its one and only layer. */
export const SINGLE_LAYER = 'map';

/** The map's layers, first = its own image; one plain layer for a map without `layers`. */
export function mapLayers(map: VenueMap): VenueMapLayer[] {
  if (map.layers?.length) return map.layers;
  let single = singles.get(map);
  if (!single) {
    single = [{ id: SINGLE_LAYER, kind: 'outside', image: map.image ?? { url: '', width: 1, height: 1 }, focus: map.focus, widthMeters: map.widthMeters, background: map.background }];
    singles.set(map, single); // the same array every call
  }
  return single;
}

const singles = new WeakMap<VenueMap, VenueMapLayer[]>();

/** The layer `id`, or the first one for an unknown id. */
export function layerById(map: VenueMap, id: string | null | undefined): VenueMapLayer {
  const layers = mapLayers(map);
  return layers.find(l => l.id === id) ?? layers[0];
}

/** The layer a facility is pinned on: its own `layer` if the map has it, else the first. */
export function layerOf(map: VenueMap, f: Pick<Facility, 'layer'>): string {
  return layerById(map, f.layer).id;
}

/**
 * The map as one layer shows it: that layer's image, focus, width and background in place of the
 * map's own. The same object for the same layer every call (the map view keys its fit on it).
 * A map without `layers` is returned as it is.
 */
export function layerView(map: VenueMap, layerId: string | null | undefined): VenueMap {
  if (!map.layers?.length) return map;
  const layer = layerById(map, layerId);
  let byLayer = views.get(map);
  if (!byLayer) views.set(map, (byLayer = new Map()));
  let view = byLayer.get(layer.id);
  if (!view) {
    view = { ...map, image: layer.image, focus: layer.focus, widthMeters: layer.widthMeters, background: layer.background ?? map.background };
    byLayer.set(layer.id, view);
  }
  return view;
}

const views = new WeakMap<VenueMap, Map<string, VenueMap>>();

function toBase(layer: VenueMapLayer, p: MapPoint): MapPoint {
  if (!layer.toBase) return { x: p.x, y: p.y };
  const [a, b, c, d, e, f] = layer.toBase;
  return { x: a * p.x + b * p.y + c, y: d * p.x + e * p.y + f };
}

function fromBase(layer: VenueMapLayer, p: MapPoint): MapPoint {
  if (!layer.toBase) return { x: p.x, y: p.y };
  const [a, b, c, d, e, f] = layer.toBase;
  const det = a * e - b * d;
  const x = p.x - c;
  const y = p.y - f;
  return { x: (e * x - b * y) / det, y: (a * y - d * x) / det };
}

/**
 * Where a point on one layer falls on another, through the first layer's frame.
 * e.g. SoFi's Entry 4 (outside) on Level 3 → the north-west edge of the concourse ring
 */
export function toLayerPoint(map: VenueMap, p: MapPoint, fromLayer: string, toLayer: string): MapPoint {
  if (fromLayer === toLayer) return { x: p.x, y: p.y };
  return fromBase(layerById(map, toLayer), toBase(layerById(map, fromLayer), p));
}
