/**
 * Directions inside a venue: from where the visitor is (./current.ts, set by "I'm here") to a
 * facility, as a dashed line on the map and a walk estimate with steps in the sheet.
 * Until the visitor says where they are, the walk starts at the venue's main way in (its map's
 * `arrival`), and the sheet says so.
 *
 * e.g. routeFor(sofiMap, sofiFacilities, { venueId: 'sofi', facilityId: null }, 'first-aid-se')
 *      → from Entry 4 (the arrival), to First Aid SE, heading 'se', about 6 min
 * A facility whose spot isn't published (`approximate`) gets no route: its pin is a placeholder.
 */
import { contentSize, walkBetween, type Box, type Walk } from './map-geometry';
import type { WhereAmI } from './current';
import type { FacilityWalk } from './labels';
import { mapAspect, type VenueMap } from './venue-maps';
import type { Facility } from './types';

export interface Route {
  from: Facility;
  to: Facility;
  /** The visitor set `from` with "I'm here"; false when it's the venue's arrival spot. */
  fromIsMine: boolean;
  /** Already there: no line to draw. */
  here: boolean;
  walk: Walk;
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
export function startMarker(route: Route | null): { kind: 'you' | 'start'; at: Facility } | null {
  if (!route || route.here) return null;
  return { kind: route.fromIsMine ? 'you' : 'start', at: route.from };
}

/** The route to `toId`, with the line in `content` px (any width works for the sheet's numbers); none to an approximate spot. */
export function routeFor(
  map: VenueMap,
  facilities: Facility[],
  where: WhereAmI,
  venueId: string,
  toId: string,
  content: Box = contentSize(mapAspect(map), 1),
): Route | null {
  const to = facilities.find(f => f.id === toId);
  const start = routeStart(map, facilities, where, venueId);
  if (!to || !start || to.approximate) return null;
  return { from: start.from, to, fromIsMine: start.mine, here: start.from.id === to.id, walk: walkBetween(start.from, to, content, map.widthMeters) };
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
  return { kind: 'walk', minutes: walkBetween(start.from, to, contentSize(mapAspect(map), 1), map.widthMeters).minutes };
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
