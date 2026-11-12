/**
 * Mock LA28 venues and their facilities, until the venue data lives in Supabase.
 * Every venue shares one facility layout (gates at the four compass points, services around the
 * concourse), named for the venue, so each map has the same clean spread of pins.
 */
import { eventsLabel, facilityDescription, facilityLocation, venueT, type VenueT } from './labels';
import type { Facility, FacilityCategory, Venue } from './types';

export const VENUES: Venue[] = [
  { id: 'sofi', name: 'SoFi Stadium', address: '1001 Stadium Dr, Inglewood, CA 90301', events: ['opening_ceremony', 'swimming'], shape: 'bowl' },
  { id: 'coliseum', name: 'LA Memorial Coliseum', address: '3911 S Figueroa St, Los Angeles, CA 90037', events: ['athletics'], shape: 'bowl' },
  { id: 'rose-bowl', name: 'Rose Bowl Stadium', address: '1001 Rose Bowl Dr, Pasadena, CA 91103', events: ['football'], shape: 'bowl' },
  { id: 'crypto-arena', name: 'Crypto.com Arena', address: '1111 S Figueroa St, Los Angeles, CA 90015', events: ['gymnastics'], shape: 'arena' },
  { id: 'intuit-dome', name: 'Intuit Dome', address: '3930 W Century Blvd, Inglewood, CA 90303', events: ['basketball'], shape: 'arena' },
];

type Template = Omit<Facility, 'venueId'>;

// Map coordinates: bowl centred at (200,200); gates sit on the outer wall, services on the concourse ring.
const LAYOUT: Template[] = [
  {
    id: 'gate-1', name: 'Gate 1', category: 'gate', x: 200, y: 56,
    description: 'North entrance, closest to the Metro shuttle stop.',
    location: 'North side, at the shuttle stop', walkMinutes: 6, wait: 'long', accessible: false,
    tags: [{ id: 'stairs', tone: 'note' }, { id: 'busy_before_events', tone: 'note' }],
  },
  {
    id: 'gate-2', name: 'Gate 2', category: 'gate', x: 362, y: 200,
    description: 'East entrance with a ramp, next to accessible parking in Lot C.',
    location: 'East side, by Lot C', walkMinutes: 3, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'ramp', tone: 'note' }, { id: 'bag_check', tone: 'note' }],
  },
  {
    id: 'gate-3', name: 'Gate 3', category: 'gate', x: 200, y: 344,
    description: 'South entrance for rideshare drop-off and pick-up.',
    location: 'South side, at the rideshare zone', walkMinutes: 8, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'rideshare', tone: 'note' }],
  },
  {
    id: 'gate-4', name: 'Gate 4', category: 'gate', x: 38, y: 200,
    description: 'West entrance for ticket holders in sections 200 to 240.',
    location: 'West side, off the main plaza', walkMinutes: 9, wait: 'none', accessible: false,
    tags: [{ id: 'escalators', tone: 'note' }],
  },
  {
    id: 'info-desk', name: 'Guest Services', category: 'info', x: 258, y: 82,
    description: 'Questions, lost tickets, sensory kits and ear defenders.',
    location: 'Concourse, section 105', walkMinutes: 4, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'sensory_kits', tone: 'note' }],
  },
  {
    id: 'first-aid', name: 'First Aid', category: 'first_aid', x: 338, y: 146,
    description: 'Nurses and EMTs on duty from gates open until the venue clears.',
    location: 'Concourse, section 112', walkMinutes: 3, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'quiet_room', tone: 'note' }],
  },
  {
    id: 'restroom-east', name: 'Restrooms East', category: 'restroom', x: 338, y: 254,
    description: 'Men’s, women’s and an all-gender family room with a changing table.',
    location: 'Concourse, section 118', walkMinutes: 4, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'family_room', tone: 'note' }],
  },
  {
    id: 'food-south', name: 'Taco Corner', category: 'food', x: 258, y: 318,
    description: 'Tacos, burritos and agua fresca. Vegetarian options.',
    location: 'Concourse, section 124', walkMinutes: 6, wait: 'long', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'long_lines_halftime', tone: 'note' }],
  },
  {
    id: 'lost-found', name: 'Lost & Found', category: 'lost_found', x: 142, y: 318,
    description: 'Drop off or pick up lost items. Lost children are brought here too.',
    location: 'Concourse, section 131', walkMinutes: 7, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }],
  },
  {
    id: 'accessible-seating', name: 'Accessibility Services', category: 'accessible', x: 62, y: 254,
    description: 'Wheelchair loans, companion seating and assistive listening devices.',
    location: 'Concourse, section 136', walkMinutes: 8, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'wheelchair_loans', tone: 'note' }],
  },
  {
    id: 'food-west', name: 'Burger Stand', category: 'food', x: 62, y: 146,
    description: 'Burgers, fries and soft drinks. Halal patties available.',
    location: 'Concourse, section 140', walkMinutes: 9, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }],
  },
  {
    id: 'restroom-west', name: 'Restrooms West', category: 'restroom', x: 142, y: 82,
    description: 'Men’s and women’s restrooms. The accessible stall is on the left.',
    location: 'Concourse, section 145', walkMinutes: 7, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }],
  },
  {
    id: 'parking-c', name: 'Parking Lot C', category: 'parking', x: 360, y: 360,
    description: 'Accessible parking with a short, level path to Gate 2.',
    location: 'Southeast lot', walkMinutes: 5, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'permit_needed', tone: 'note' }],
  },
];

export function getVenue(id: string | undefined): Venue | undefined {
  return VENUES.find(v => v.id === id);
}

export function facilitiesFor(venueId: string): Facility[] {
  return LAYOUT.map(f => ({ ...f, venueId }));
}

export function getFacility(venueId: string, facilityId: string | undefined): Facility | undefined {
  return facilitiesFor(venueId).find(f => f.id === facilityId);
}

/** Venues whose name, address or events (in English or the app language) contain every word of the query (case-insensitive). */
export function searchVenues(query: string, venues: Venue[] = VENUES, t: VenueT = venueT()): Venue[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return venues;
  return venues.filter(v => {
    const hay = `${v.name} ${v.address} ${eventsLabel(v, venueT('en'), 'en')} ${eventsLabel(v, t)}`.toLowerCase();
    return words.every(w => hay.includes(w));
  });
}

/** "Accessibility" also matches any facility that is accessible, not only the services desk. */
export function matchesCategory(f: Facility, category: FacilityCategory | null): boolean {
  if (!category) return true;
  return f.category === category || (category === 'accessible' && f.accessible);
}

/** Matches name, description and location, in English and in `t`'s language. */
export function searchFacilities(facilities: Facility[], query: string, category: FacilityCategory | null, t: VenueT = venueT()): Facility[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return facilities.filter(f => {
    if (!matchesCategory(f, category)) return false;
    const hay = `${f.name} ${f.description} ${f.location} ${facilityDescription(f, t)} ${facilityLocation(f, t)}`.toLowerCase();
    return words.every(w => hay.includes(w));
  });
}
