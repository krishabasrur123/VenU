// Where the visitor waits, stored as ids and worded at render, so it follows a language switch.
// e.g. { venueId: 'sofi', facilityId: 'entry-4' } → "Near Entry 4 · SoFi Stadium" (en),
//      "Cerca de Entrada 4 · SoFi Stadium" (es); facilityId null → "SoFi Stadium".
import type { TFunction } from 'i18next';

import { CATEGORIES } from '@/features/venue/categories';
import { DEFAULT_WHERE, isMeetSpot, type WhereAmI } from '@/features/venue/current';
import { facilityName, type VenueT } from '@/features/venue/labels';
import { facilitiesFor, getFacility, getVenue, searchFacilities, VENUES } from '@/features/venue/mock';
import type { Facility, FacilityCategory } from '@/features/venue/types';

import type { MeetPoint } from './types';

export type VolunteerT = TFunction<'volunteer'>;

/** The help request's meet point from the current venue and spot. */
export function meetPointFrom(where: WhereAmI): MeetPoint {
  return { venueId: where.venueId, facilityId: where.facilityId };
}

/**
 * A saved meet point, made safe to show: unknown ids fall back to the default venue / no spot.
 * Requests saved before ids held translated text ({ spot: 'Near Gate 2 Ramp', venue: 'SoFi Stadium' });
 * those keep their venue (matched by name) and drop the spot, which no longer names a real place.
 */
export function restoreMeetPoint(value: unknown): MeetPoint {
  if (!value || typeof value !== 'object') return { ...DEFAULT_WHERE };
  const v = value as Record<string, unknown>;
  if (typeof v.venueId === 'string' && getVenue(v.venueId)) {
    const facilityId = typeof v.facilityId === 'string' && getFacility(v.venueId, v.facilityId) ? v.facilityId : null;
    return { venueId: v.venueId, facilityId };
  }
  const byName = typeof v.venue === 'string' ? VENUES.find(x => x.name === v.venue) : undefined;
  return { venueId: byName?.id ?? DEFAULT_WHERE.venueId, facilityId: null };
}

/**
 * The spots a visitor can pick in "Where are you?": the venue's facilities without the ones it
 * doesn't publish (see isMeetSpot). e.g. Intuit Dome → everything but Elevators and Sensory Room.
 */
export function meetSpotsFor(venueId: string): Facility[] {
  return facilitiesFor(venueId).filter(isMeetSpot);
}

/**
 * The "Where are you?" list: facilities matching the search and chip, in chip order (gates first),
 * keeping the venue's own order within a type. e.g. "entrada" in Spanish at SoFi Stadium → its Entries.
 */
export function spotChoices(facilities: Facility[], query: string, category: FacilityCategory | null, tv?: VenueT): Facility[] {
  const order = (f: Facility) => CATEGORIES.indexOf(f.category);
  return searchFacilities(facilities, query, category, tv)
    .map((f, i) => ({ f, i }))
    .sort((a, b) => order(a.f) - order(b.f) || a.i - b.i)
    .map(x => x.f);
}

/** "SoFi Stadium" (venue names are never translated). */
export function meetVenueName(point: MeetPoint): string {
  return getVenue(point.venueId)?.name ?? point.venueId;
}

/** The facility's name in `tv`'s language ("Entrada 4"), or null with no spot. */
export function meetSpotName(point: MeetPoint, tv: VenueT): string | null {
  const f = point.facilityId ? getFacility(point.venueId, point.facilityId) : undefined;
  return f ? facilityName(f, tv) : null;
}

/** "Near Entry 4", or null with no spot. */
export function meetSpotLabel(point: MeetPoint, tv: VenueT, t: VolunteerT): string | null {
  const place = meetSpotName(point, tv);
  return place ? t('form.near', { place }) : null;
}

/** One line for cards: "Near Entry 4 · SoFi Stadium", or just "SoFi Stadium". */
export function meetPlaceLine(point: MeetPoint, tv: VenueT, t: VolunteerT): string {
  const spot = meetSpotLabel(point, tv, t);
  const venue = meetVenueName(point);
  return spot ? t('place', { spot, venue }) : venue;
}
