/**
 * Facility categories: the header chips and each pin's icon. Icons are cut out of the Figma
 * "Icons" sheet (131:3653, one 213x88 SVG holding all eight glyphs).
 */
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { FIGMA_ICONS } from '@/components/icons/figma-icons';
import { Colors } from '@/constants/theme';

import { echoQuery, venueT, type VenueT } from './labels';
import { matchesCategory } from './mock';
import type { Facility, FacilityCategory } from './types';

/** Header chip order; labels come from venue:category.<value> (categoryLabel in ./labels). */
export const CATEGORIES: FacilityCategory[] = ['gate', 'restroom', 'food', 'first_aid', 'lost_found', 'info', 'accessible', 'parking'];

/**
 * The chips worth showing for a list of facilities: those with at least one of them (see
 * matchesCategory), in CATEGORIES order, so a chip never empties the map. `keep` stays even when
 * empty (the chip that's selected).
 * e.g. Intuit Dome's own facilities list no food, so the "Where are you?" picker has no
 * "Food & Drinks" chip; the venue screen adds the sponsored stands (venueFacilitiesFor in
 * ./sponsors.ts), so its "Food & Drinks" chip shows and lists those stands, each marked Sponsored.
 */
export function categoriesAt(facilities: Facility[], keep: FacilityCategory | null = null): FacilityCategory[] {
  return CATEGORIES.filter(c => c === keep || facilities.some(f => matchesCategory(f, c)));
}

/** The facility list's empty line: `No restrooms match "xyz"`, or `No parking lots at SoFi Stadium yet`. */
export function emptyFacilitiesMessage(category: FacilityCategory | null, query: string, venueName: string, t: VenueT = venueT()): string {
  const kind = category ?? 'all';
  const q = echoQuery(query);
  return q ? t(`emptyMatch.${kind}`, { query: q }) : t(`emptyNone.${kind}`, { venue: venueName });
}

/** Square crops (x y size) of each glyph in the icon sheet. */
const CROPS: Record<FacilityCategory, [number, number, number]> = {
  restroom: [0, 1.5, 33],
  gate: [135.5, 1.5, 32],
  accessible: [179.5, 0, 33],
  first_aid: [0, 54.5, 33],
  lost_found: [45, 54.5, 33],
  food: [89, 53.5, 36],
  parking: [134, 54, 35],
  info: [179.5, 54.5, 34],
};

// The sheet mixes #242222 and black for the glyphs, with white details (the first-aid cross) on top:
// glyphs take `color`, details take `background` so they read on any pin.
const SHEET = FIGMA_ICONS['icons-82d19f'].replace(/(fill|stroke)="(#242222|black)"/g, '$1="currentColor"');

// One cropped copy of the sheet per (category, background), built on first use: the map and list
// draw ~26 of these, and re-running the replaces on every render was wasted work.
const cropCache = new Map<string, string>();

/** The icon sheet cropped to one glyph, with its white details painted `background`. */
export function facilityIconXml(category: FacilityCategory, background: string): string {
  const key = `${category}|${background}`;
  let xml = cropCache.get(key);
  if (!xml) {
    const [x, y, s] = CROPS[category];
    xml = SHEET.replace(/(fill|stroke)="white"/g, `$1="${background}"`).replace(/width="213" height="88" viewBox="0 0 213 88"/, `width="${s}" height="${s}" viewBox="${x} ${y} ${s} ${s}"`);
    cropCache.set(key, xml);
  }
  return xml;
}

export function FacilityIcon({ category, size = 24, color = Colors.ink, background = Colors.surface }: {
  category: FacilityCategory;
  size?: number;
  color?: string;
  /** Colour behind the icon, for its cut-out details. */
  background?: string;
}) {
  const xml = facilityIconXml(category, background);
  return (
    <View style={{ width: size, height: size }} aria-hidden>
      <SvgXml xml={xml} width={size} height={size} color={color} />
    </View>
  );
}
