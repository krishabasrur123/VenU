/**
 * Sponsored stands: a demo of how VenU could earn money, for the Intuit pitch.
 *
 * DEMO PLACEMENTS ONLY. None of these brands has a partnership with VenU, LA28 or the venues; the
 * names are real brands as plain text so the demo reads true, and the stands, spots and offers are
 * made up. Never show a brand's logo, artwork or colours: the UI uses VenU's own Sponsored icon and
 * theme colours, and always says "Sponsored" (on screen and to screen readers).
 *
 * Where ads go: the venue map (a Sponsored pin), one promoted card in the facility list, the offer on
 * the stand, and one banner while a visitor waits for a volunteer. Never in the emergency dialog,
 * the meeting-spot picker or any other volunteer screen: these stands are kept out of
 * facilitiesFor() (./mock.ts), which those screens read, and only the venue screen adds them.
 *
 * Spots sit on each venue's map like the facilities in ./mock.ts (x, y from 0 to 1):
 * - Intuit Dome: the plaza's seating by the outdoor court, and the Main Level concourse past The Wall
 *   Entrance (north side of the bowl).
 * - SoFi Stadium: under the canopy inside Entries 1 and 2, and American Airlines Plaza (south-east).
 * - Crypto.com Arena: the Main Concourse on the Figueroa side, between Star Plaza and Guest Services M12.
 * `walkMinutes` is the walk from the venue's main way in (its map's `arrival`), so the list, the
 * stand's page and its route agree; `wait` is a stand-in, as in ./mock.ts.
 */
import { walkFromStart } from './directions';
import type { FacilityWalk } from './labels';
import { facilitiesFor, getVenue } from './mock';
import type { Facility, FacilityCategory, FacilitySponsor } from './types';
import { venueMapFor } from './venue-maps';

type Template = Omit<Facility, 'venueId'>;

/** A facility with a sponsor: a paid placement. */
export type SponsoredStand = Facility & { sponsor: FacilitySponsor };

// The first stand per venue is its featured one: the promoted list card and the waiting banner.
const SPONSORED_STANDS: Readonly<Record<string, Template[]>> = {
  'intuit-dome': [
    {
      id: 'coca-cola-refresh-intuit', name: 'Coca-Cola Refresh Stand', category: 'food', x: 0.300, y: 0.398,
      description: 'Cold Coca-Cola drinks, bottled water and snacks.',
      location: 'On the plaza, by the outdoor court', walkMinutes: 1, wait: 'short', accessible: true,
      tags: [{ id: 'accessible', tone: 'good' }],
      sponsor: { brand: 'Coca-Cola', offer: '$1 off any Coca-Cola drink with VenU' },
    },
    {
      id: 'panda-express-intuit', name: 'Panda Express Stand', category: 'food', x: 0.448, y: 0.572,
      description: 'Orange chicken, chow mein and rice bowls.',
      location: 'Main Level concourse, past The Wall Entrance', walkMinutes: 2, wait: 'long', accessible: true,
      tags: [{ id: 'accessible', tone: 'good' }, { id: 'long_lines_halftime', tone: 'note' }],
      sponsor: { brand: 'Panda Express', offer: 'Free egg roll with any bowl' },
    },
  ],
  sofi: [
    {
      id: 'coca-cola-refresh-sofi', name: 'Coca-Cola Refresh Stand', category: 'food', x: 0.405, y: 0.343,
      description: 'Cold Coca-Cola drinks, bottled water and snacks.',
      location: 'Level 1, inside Entries 1 and 2', walkMinutes: 2, wait: 'short', accessible: true,
      tags: [{ id: 'accessible', tone: 'good' }],
      sponsor: { brand: 'Coca-Cola', offer: '$1 off any Coca-Cola drink with VenU' },
    },
    {
      id: 'ben-jerrys-sofi', name: 'Ben & Jerry’s Scoop Stand', category: 'food', x: 0.492, y: 0.470,
      description: 'Ice cream cups and cones.',
      location: 'American Airlines Plaza', walkMinutes: 9, wait: 'short', accessible: true,
      tags: [{ id: 'accessible', tone: 'good' }],
      sponsor: { brand: 'Ben & Jerry’s', offer: 'Free topping on any scoop' },
    },
  ],
  'crypto-arena': [
    {
      id: 'coca-cola-refresh-crypto', name: 'Coca-Cola Refresh Stand', category: 'food', x: 0.875, y: 0.310,
      description: 'Cold Coca-Cola drinks, bottled water and snacks.',
      location: 'Main Concourse, Figueroa side', walkMinutes: 1, wait: 'short', accessible: true,
      tags: [{ id: 'accessible', tone: 'good' }],
      sponsor: { brand: 'Coca-Cola', offer: '$1 off any Coca-Cola drink with VenU' },
    },
  ],
};

export function isSponsored(f: Facility): f is SponsoredStand {
  return !!f.sponsor;
}

/**
 * Whether people can post community reports on a facility: not on a sponsored stand, so a paid
 * listing never carries reports (or gets them written to the database under it).
 */
export function takesReports(f: Facility): boolean {
  return !isSponsored(f);
}

const stands = new Map<string, SponsoredStand[]>();
const withStands = new Map<string, Facility[]>();

/** The venue's sponsored stands (none for an unknown venue); the same array every call. */
export function sponsoredStandsFor(venueId: string): SponsoredStand[] {
  let list = stands.get(venueId);
  if (!list) {
    const templates = Object.prototype.hasOwnProperty.call(SPONSORED_STANDS, venueId) ? SPONSORED_STANDS[venueId] : [];
    list = templates.map(f => ({ ...f, venueId }) as SponsoredStand);
    stands.set(venueId, list);
  }
  return list;
}

/** What the venue screen shows: the venue's facilities, then its sponsored stands. The same array every call. */
export function venueFacilitiesFor(venueId: string): Facility[] {
  let list = withStands.get(venueId);
  if (!list) {
    list = [...facilitiesFor(venueId), ...sponsoredStandsFor(venueId)];
    withStands.set(venueId, list);
  }
  return list;
}

/** The venue's featured stand (its promoted card and waiting banner), if it has one. */
export function featuredStandFor(venueId: string): SponsoredStand | undefined {
  return sponsoredStandsFor(venueId)[0];
}

export interface FacilityListLayout {
  /** The list's rows, without the featured stand when its card shows (so it isn't listed twice). */
  rows: Facility[];
  /** The promoted card's stand, or null to show no card. */
  promoted: SponsoredStand | null;
  /** The row the card goes before. */
  promotedAt: number;
}

/**
 * Where the promoted card goes in the facility list (`results`: already searched, filtered and sorted).
 * - One card per venue, only for "All" or "Food & Drinks", never under another chip (first aid,
 *   gates…), and only while the stand matches the search: a search for "restroom" shows no ad.
 * - Browsing (no search): first. Searching: after the first result, so the best match stays on top.
 * e.g. no search, "All" → card first, then every other facility; search "first aid" → no card.
 */
export function facilityListLayout(results: Facility[], featured: SponsoredStand | undefined, query: string, category: FacilityCategory | null): FacilityListLayout {
  const shown = !!featured && (category === null || category === 'food') && results.some(f => f.id === featured.id);
  if (!shown) return { rows: results, promoted: null, promotedAt: 0 };
  const rows = results.filter(f => f.id !== featured.id);
  return { rows, promoted: featured, promotedAt: query.trim() && rows.length ? 1 : 0 };
}

export interface WaitingBanner {
  stand: SponsoredStand;
  /** The walk from where the visitor said they are (or the venue's main way in), as walkTo gives it. */
  walk: FacilityWalk;
}

/**
 * The sponsor banner on the waiting screen: only for a visitor whose request is still searching, at
 * a venue with a featured stand. Every other screen and state (volunteers, matched, chat, feedback,
 * the emergency dialog) gets null.
 * e.g. ({ role: 'visitor', status: 'searching', location: { venueId: 'intuit-dome', facilityId: null } })
 *      → Coca-Cola Refresh Stand, { kind: 'walk', minutes: 1 } from the Main Entrance
 */
export function waitingBannerFor(state: {
  role: string | null | undefined;
  status: string;
  location: { venueId: string; facilityId: string | null } | null | undefined;
}): WaitingBanner | null {
  if (state.role !== 'visitor' || state.status !== 'searching' || !state.location) return null;
  const { venueId, facilityId } = state.location;
  const venue = getVenue(venueId);
  const stand = featuredStandFor(venueId);
  if (!venue || !stand) return null;
  const walk = walkFromStart(venueMapFor(venue), venueFacilitiesFor(venueId), { venueId, facilityId }, venueId, stand);
  return { stand, walk: walk ?? { kind: 'walk', minutes: stand.walkMinutes } };
}
