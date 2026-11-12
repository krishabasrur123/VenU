/**
 * Translated display text for venue records: event names, categories, tags, wait levels and the
 * mock facilities' descriptions. Names and street addresses are never translated.
 *
 * Components pass their own `t` from useT('venue'): the React Compiler memoizes calls by their
 * arguments, so a helper that read the global language would keep showing the old one.
 * e.g. facilityMeta(gate2, t) → "3 min walk · Short wait" (en), "3 min a pie · Poca espera" (es)
 */
import type { TFunction } from 'i18next';

import i18n from '@/i18n';
import { formatList } from '@/i18n/format';
import { en } from '@/i18n/locales';

import type { Facility, FacilityCategory, FacilityTag, Venue } from './types';

export type VenueT = TFunction<'venue'>;

/** The venue namespace in the current language (or `language`), for code outside components. */
export function venueT(language?: string): VenueT {
  return i18n.getFixedT(language ?? i18n.language, 'venue');
}

/** "Opening Ceremony, Swimming". Pass `language` only together with a `t` for that language. */
export function eventsLabel(venue: Venue, t: VenueT = venueT(), language = i18n.language): string {
  return formatList(venue.events.map(e => t(`events.${e}`)), language);
}

export function categoryLabel(category: FacilityCategory, t: VenueT = venueT()): string {
  return t(`category.${category}`);
}

export function tagLabel(tag: FacilityTag, t: VenueT = venueT()): string {
  return t(`tags.${tag.id}`);
}

const FACILITY_TEXT = en.venue.facilityText;
type KnownFacility = keyof typeof FACILITY_TEXT;
const isKnown = (id: string): id is KnownFacility => id in FACILITY_TEXT;

/** The facility's description in `t`'s language; a facility without a translation keeps its own text. */
export function facilityDescription(f: Facility, t: VenueT = venueT()): string {
  const id = f.id;
  return isKnown(id) ? t(`facilityText.${id}.description`) : f.description;
}

/** "East side, by Lot C", translated like the description. */
export function facilityLocation(f: Facility, t: VenueT = venueT()): string {
  const id = f.id;
  return isKnown(id) ? t(`facilityText.${id}.location`) : f.location;
}

/** "3 min walk · Short wait". */
export function facilityMeta(f: Facility, t: VenueT = venueT()): string {
  return `${t('walk', { count: f.walkMinutes })} · ${t(`wait.${f.wait}`)}`;
}
