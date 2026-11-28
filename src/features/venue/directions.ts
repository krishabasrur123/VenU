/**
 * Directions inside a venue: from where the visitor is (./current.ts, set by "I'm here") to a
 * facility, as a dashed line on the map and a walk estimate with steps in the sheet.
 * Until the visitor says where they are, the walk starts at the venue's main way in (its map's
 * `arrival`), and the sheet says so.
 *
 * e.g. routeFor(sofiMap, sofiFacilities, { venueId: 'sofi', facilityId: null }, 'first-aid-se')
 *      → from Entry 4 (the arrival), to First Aid SE, heading 'se', about 6 min
 * A facility whose spot isn't published (`approximate`) gets no route: its pin is a placeholder.
 *
 * Across layers (SoFi's outside map and its concourse levels): the walk is measured and drawn on the
 * facility's layer, from where the start falls on it (Entry 4 lands on the north-west edge of the
 * Level 3 ring), plus LEVEL_CHANGE_MINUTES for the elevator, escalator or ramp, and the steps say to
 * change level. e.g. Entry 4 → First Aid NE (Level 3): "Take an elevator or escalator to Level 3",
 * then head east on the Level 3 map.
 */
import { contentSize, walkBetween, type Box, type MapPoint, type Walk } from './map-geometry';
import type { WhereAmI } from './current';
import type { FacilityWalk } from './labels';
import { layerById, layerOf, mapAspect, toLayerPoint, type VenueMap, type VenueMapLayer } from './venue-maps';
import type { Facility } from './types';

/** Added to a walk that changes layer: finding and riding an elevator or escalator, or the ramp. */
export const LEVEL_CHANGE_MINUTES = 2;

export interface Route {
  from: Facility;
  to: Facility;
  /** The visitor set `from` with "I'm here"; false when it's the venue's arrival spot. */
  fromIsMine: boolean;
  /** Already there: no line to draw. */
  here: boolean;
  walk: Walk;
  /** The layer the route is drawn on: the facility's. */
  layer: string;
  /** Where the walk starts on that layer: `from`'s pin, or where `from` falls on it from its own layer. */
  start: MapPoint;
  /** The layer the walk changes to on the way (the facility's), or null when both are on one layer. */
  levelChange: VenueMapLayer | null;
}

/**
 * The walk from `from` to `to`, on `to`'s layer (see the header): the start as it falls on that
 * layer, the walk in `content` px of it, and the layer it changes to, if any.
 */
function walkAcross(map: VenueMap, from: Facility, to: Facility, content?: Box): Pick<Route, 'walk' | 'layer' | 'start' | 'levelChange'> {
  const fromLayer = layerOf(map, from);
  const layer = layerById(map, layerOf(map, to));
  const start = toLayerPoint(map, from, fromLayer, layer.id);
  const walk = walkBetween(start, to, content ?? contentSize(mapAspect(layer), 1), layer.widthMeters);
  if (fromLayer === layer.id) return { walk, layer: layer.id, start, levelChange: null };
  return { walk: { ...walk, minutes: walk.minutes + LEVEL_CHANGE_MINUTES }, layer: layer.id, start, levelChange: layer };
}

/**
 * Where a walk at this venue starts: the visitor's own spot, else the main way in, else the first
 * facility. An own spot whose place isn't published (`approximate`) can't start a walk.
 */
export function routeStart(map: VenueMap, facilities: Facility[], where: WhereAmI, venueId: string): { from: Facility; mine: boolean } | null {
  const mine = where.venueId === venueId && where.facilityId ? facilities.find(f => f.id === where.facilityId) : undefined;
  if (mine && !mine.approximate) return { from: mine, mine: true };
  const arrival = facilities.find(f => f.id === map.arrival) ?? facilities[0];
  return arrival ? { from: arrival, mine: false } : null;
}

/**
 * How the map marks where a walk starts: "you" (a dot in place of the pin) only when the visitor set
 * that spot with "I'm here"; otherwise "start", a tag on the way in's own pin, which stays drawn.
 * Nothing when already there.
 */
export function startMarker(route: Route | null): { kind: 'you' | 'start'; at: Facility; point: MapPoint } | null {
  if (!route || route.here) return null;
  return { kind: route.fromIsMine ? 'you' : 'start', at: route.from, point: route.start };
}

/**
 * The route to `toId`, with the line in `content` px of the facility's layer (any width works for
 * the sheet's numbers); none to an approximate spot.
 */
export function routeFor(
  map: VenueMap,
  facilities: Facility[],
  where: WhereAmI,
  venueId: string,
  toId: string,
  content?: Box,
): Route | null {
  const to = facilities.find(f => f.id === toId);
  const start = routeStart(map, facilities, where, venueId);
  if (!to || !start || to.approximate) return null;
  return { from: start.from, to, fromIsMine: start.mine, here: start.from.id === to.id, ...walkAcross(map, start.from, to, content) };
}

/**
 * How far `to` is from where walks start, as the list, pin card and detail show it: the same
 * minutes the route panel says, "start" / "mine" for the starting spot itself, or "ask" for a
 * spot that isn't published. Null when the venue has nowhere to start from.
 * e.g. walkFromStart(intuitMap, intuitFacilities, nowhere, 'intuit-dome', mainEntrance) → { kind: 'start' }
 */
export function walkFromStart(map: VenueMap, facilities: Facility[], where: WhereAmI, venueId: string, to: Facility): FacilityWalk | null {
  return walkFrom(map, routeStart(map, facilities, where, venueId), to);
}

/**
 * walkFromStart with the start already found (routeStart), for a screen that measures many
 * facilities from the same start: find it once per render, not once per facility.
 */
export function walkFrom(map: VenueMap, start: ReturnType<typeof routeStart>, to: Facility): FacilityWalk | null {
  // The start first: it reads "Walks start here" / "You're here" even if its own pin is a placeholder.
  if (start && start.from.id === to.id) return { kind: start.mine ? 'mine' : 'start' };
  if (to.approximate) return { kind: 'ask' };
  if (!start) return null;
  return { kind: 'walk', minutes: walkAcross(map, start.from, to).walk.minutes };
}

/** Sorts nearest first: the start, then by minutes, then spots that aren't published. */
export function walkOrder(w: FacilityWalk | null): number {
  if (!w) return Number.MAX_SAFE_INTEGER;
  return w.kind === 'walk' ? w.minutes : w.kind === 'ask' ? Number.MAX_SAFE_INTEGER - 1 : -1;
}

/**
 * The facility list's order: each facility with its walk (`walkOf`, the screen's walkTo), nearest
 * first by walkOrder; equal walks keep their order.
 */
export function nearestFirst(facilities: Facility[], walkOf: (f: Facility) => FacilityWalk | null): { f: Facility; walk: FacilityWalk | null }[] {
  return facilities.map(f => ({ f, walk: walkOf(f) })).sort((a, b) => walkOrder(a.walk) - walkOrder(b.walk));
}
