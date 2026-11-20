/**
 * Translated display text for venue records: event names, categories, tags, wait levels and the
 * mock facilities' names and descriptions. Venue names and street addresses are never translated.
 *
 * Components pass their own `t` from useT('venue'): the React Compiler memoizes calls by their
 * arguments, so a helper that read the global language would keep showing the old one.
 * e.g. facilityMeta(entry4, t) → "4 min walk · Short wait" (en), "4 min a pie · Poca espera" (es)
 */
import type { TFunction } from 'i18next';

import i18n, { languageOf } from '@/i18n';
import { formatList, formatNumber } from '@/i18n/format';
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

/**
 * The facility's name in `t`'s language: "Entry 4" → "Entrada 4" (es), "ورودی ۴" (fa). A facility
 * without a translated name keeps its own.
 */
export function facilityName(f: Facility, t: VenueT = venueT()): string {
  const id = f.id;
  return isKnown(id) && 'name' in FACILITY_TEXT[id] ? t(`facilityText.${id}.name` as never) : f.name;
}

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

/** A sponsored stand's offer, translated like the description; '' for a facility without a sponsor. */
export function facilityOffer(f: Facility, t: VenueT = venueT()): string {
  if (!f.sponsor) return '';
  const id = f.id;
  return isKnown(id) && 'offer' in FACILITY_TEXT[id] ? t(`facilityText.${id}.offer` as never) : f.sponsor.offer;
}

/** Longest search text echoed back in an empty-results line before it's cut with "…". */
export const ECHO_MAX = 40;

/**
 * The search as echoed in "No restrooms match “…”": trimmed, and cut to ECHO_MAX characters so a
 * pasted paragraph doesn't fill the sheet.
 * e.g. echoQuery('  taco ') → 'taco'; echoQuery('x'.repeat(300)) → 'xxx…' (40 x's, then …)
 */
export function echoQuery(query: string): string {
  const q = query.trim();
  const chars = [...q]; // by code point, so an emoji or a surrogate pair isn't split
  return chars.length > ECHO_MAX ? `${chars.slice(0, ECHO_MAX).join('').trimEnd()}…` : q;
}

/**
 * How far a facility is from where walks start (see walkFromStart in ./directions): a walk in
 * minutes, the start itself (the way in, or the visitor's own "I'm here" spot), or `ask` when its
 * spot isn't published.
 */
export type FacilityWalk = { kind: 'walk'; minutes: number } | { kind: 'start' | 'mine' | 'ask' };

/**
 * A walk as every screen words it: "3 min walk" (in the language's digits: "۳ دقیقه پیاده‌روی"),
 * "Walks start here", "You're here" or "Spot not published".
 */
export function walkLabel(w: FacilityWalk, t: VenueT = venueT()): string {
  return w.kind === 'walk'
    ? t('walk', { count: w.minutes, number: formatNumber(w.minutes, undefined, languageOf(t)) })
    : t(w.kind === 'start' ? 'walkStart' : w.kind === 'mine' ? 'walkMine' : 'walkAsk');
}

/**
 * "3 min walk · Short wait": the walk (see walkLabel), then the wait. Without a `walk` it falls
 * back to the facility's stand-in walkMinutes.
 */
export function facilityMeta(f: Facility, t: VenueT = venueT(), walk?: FacilityWalk | null): string {
  return `${walkLabel(walk ?? { kind: 'walk', minutes: f.walkMinutes }, t)} · ${t(`wait.${f.wait}`)}`;
}

/**
 * Text without its closing full stop, for a template that adds its own.
 * e.g. withoutFinalStop('Entrance on 102nd St.') → 'Entrance on 102nd St'; withoutFinalStop('Main 6') → 'Main 6'
 */
export function withoutFinalStop(text: string): string {
  return text.replace(/[.。．]\s*$/u, '');
}
