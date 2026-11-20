/**
 * The map each venue screen draws its pins on: the venue's own published static map where it has a
 * usable one, hotlinked from its site (never committed), else VenU's schematic drawing.
 * Facility pins (x, y in ./mock.ts) are normalized positions on this image.
 *
 * Every venue also keeps a link to its interactive map page. That page can't be framed and
 * controlled (it's cross-origin), so it opens in the browser instead.
 *
 * e.g. venueMapFor('sofi')?.image?.url → SoFi's "Parking Zones" map with the numbered entries
 */
import type { MapRect } from './map-geometry';
import type { Venue, VenueShape } from './types';

export interface VenueMapImage {
  url: string;
  /** Pixel size of the published image, for laying it out before it loads. */
  width: number;
  height: number;
}

export interface VenueMap {
  /** Who made the map, as shown in "Map: <source>". A proper name, so never translated. */
  source: string;
  /** The venue's interactive map page, opened by "Open interactive map"; null hides the link. */
  pageUrl: string | null;
  /** The published image, or null for the schematic drawing of `shape`. */
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
}

const MAPS: Readonly<Record<string, VenueMap>> = {
  // SoFi's own parking zones map (as of 06.03.25) from sofistadium.com/plan-your-visit/parking-and-
  // transportation: the stadium, its numbered entries, the lots and streets, north up. Prairie Ave.
  // to Yukon Ave. (about 1 km) spans 45% of its width.
  sofi: {
    source: 'SoFi Stadium',
    pageUrl: 'https://www.sofistadium.com/plan-your-visit/maps',
    image: { url: 'https://www.sofistadium.com/assets/img/Overall_SoFiStadium_Map_2025-20147a9837.jpg', width: 2550, height: 3300 },
    shape: 'bowl',
    focus: [0.25, 0.2, 0.61, 0.54],
    widthMeters: 2200,
    arrival: 'entry-4',
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
  // cryptoarena.com publishes no static map or seating chart image (checked 2026-11-16), only the
  // interactive Wayfyndr map, so the schematic arena stands in.
  'crypto-arena': {
    source: 'Crypto.com Arena',
    pageUrl: 'https://visit.cryptoarena.com/map',
    image: null,
    shape: 'arena',
    focus: [0, 0, 1, 1],
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
export function mapAspect(map: VenueMap): number {
  return map.image ? map.image.width / map.image.height : 1;
}
