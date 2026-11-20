/**
 * Mock LA28 venues and their facilities, until the venue data lives in Supabase.
 * SoFi Stadium, Crypto.com Arena and Intuit Dome list what each venue's own guest guide names
 * (entries, guest services, first aid, sensory spaces, drop-off, parking), so names match the
 * official map and signs.
 *
 * - Pins (`x`, `y`, 0 to 1) are placed by hand on the venue's map (./venue-maps.ts): SoFi's on the
 *   numbered entries and lots of its parking zones map, Intuit Dome's on its exterior map, and
 *   Crypto.com Arena's on the schematic arena (outline 0.09 to 0.91 across, 0.14 to 0.86 down).
 * - `walkMinutes` and `wait` are stand-ins for live data, e.g. a gate is a "Long wait" before doors.
 * - `accessible` = the guide says it's step-free or reachable by the venue's elevators/ramp.
 */
import { languageOf } from '@/i18n';

import { categoryLabel, eventsLabel, facilityDescription, facilityLocation, facilityName, facilityOffer, tagLabel, venueT, type VenueT } from './labels';
import type { Facility, FacilityCategory, Venue } from './types';

export const VENUES: Venue[] = [
  { id: 'sofi', name: 'SoFi Stadium', address: '1001 Stadium Dr, Inglewood, CA 90301', events: ['opening_ceremony', 'swimming'], shape: 'bowl' },
  { id: 'crypto-arena', name: 'Crypto.com Arena', address: '1111 S Figueroa St, Los Angeles, CA 90015', events: ['gymnastics'], shape: 'arena' },
  { id: 'intuit-dome', name: 'Intuit Dome', address: '3930 W Century Blvd, Inglewood, CA 90303', events: ['basketball'], shape: 'arena' },
];

type Template = Omit<Facility, 'venueId'>;

// SoFi Stadium. Sources (read 2026-11-15):
//   https://www.sofistadium.com/plan-your-visit/a-z-guide
//   https://www.sofistadium.com/plan-your-visit/accessibility
//   https://www.sofistadium.com/plan-your-visit/parking-and-transportation/accessible-parking
//   https://www.sofistadium.com/parking-and-transportation
// Entries 1–5 north, 6–7 west (VIP), 8–10 south, 11–12 east (VIP); podiums inside 4, 8 and 10.
// Six of the twelve are listed. Lost and found is at the Guest Services on your seat's level.
// Kareem Ct. between Pincay Dr. and Manchester Blvd. is north of the stadium. District Dr. is
// reached from Prairie Ave. (the west edge), so the accessible drop-off sits west. Parking zones
// sit by the entries the guide says they're closest to.
const SOFI: Template[] = [
  {
    id: 'entry-3', name: 'Entry 3', category: 'gate', x: 0.364, y: 0.325,
    description: 'North entrance. Every entry has an accessible path and free wheelchair escorts.',
    location: 'North side', walkMinutes: 5, wait: 'long', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'wheelchair_escort', tone: 'note' }, { id: 'bag_check', tone: 'note' }],
  },
  {
    id: 'entry-4', name: 'Entry 4', category: 'gate', x: 0.344, y: 0.330,
    description: 'North entrance with an accessibility podium and waiting chairs inside.',
    location: 'North side', walkMinutes: 4, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'wheelchair_escort', tone: 'note' }, { id: 'bag_check', tone: 'note' }],
  },
  {
    id: 'entry-6', name: 'Entry 6', category: 'gate', x: 0.302, y: 0.394,
    description: 'West entrance for VIP and premium ticket holders.',
    location: 'West side', walkMinutes: 9, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'premium_access', tone: 'note' }],
  },
  {
    id: 'entry-8', name: 'Entry 8', category: 'gate', x: 0.406, y: 0.491,
    description: 'South entrance with an accessibility podium and waiting chairs inside.',
    location: 'South side', walkMinutes: 7, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'wheelchair_escort', tone: 'note' }, { id: 'bag_check', tone: 'note' }],
  },
  {
    id: 'entry-10', name: 'Entry 10', category: 'gate', x: 0.530, y: 0.444,
    description: 'South entrance with an accessibility podium and waiting chairs inside.',
    location: 'South side', walkMinutes: 6, wait: 'long', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'wheelchair_escort', tone: 'note' }, { id: 'busy_before_events', tone: 'note' }],
  },
  {
    id: 'entry-11', name: 'Entry 11', category: 'gate', x: 0.501, y: 0.400,
    description: 'East entrance for VIP and premium ticket holders.',
    location: 'East side', walkMinutes: 8, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'premium_access', tone: 'note' }],
  },
  {
    id: 'guest-services-ne', name: 'Guest Services NE', category: 'info', x: 0.446, y: 0.357,
    description: 'Questions, lost items, assistive listening, free sensory kits and a sensory room.',
    location: 'Level 3, northeast concourse', walkMinutes: 3, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'sensory_room', tone: 'note' }, { id: 'sensory_kits', tone: 'note' }, { id: 'assistive_listening', tone: 'note' }],
  },
  {
    id: 'guest-services-sw', name: 'Guest Services SW', category: 'info', x: 0.372, y: 0.440,
    description: 'Inside the Corona Beach Club. Lost items, assistive listening, free sensory kits and a sensory room.',
    location: 'Level 3, southwest concourse', walkMinutes: 8, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'sensory_room', tone: 'note' }, { id: 'sensory_kits', tone: 'note' }, { id: 'lost_items', tone: 'note' }],
  },
  {
    id: 'first-aid-se', name: 'First Aid SE', category: 'first_aid', x: 0.462, y: 0.440,
    description: 'EMTs on site. Any usher or staff member can call them to you.',
    location: 'Level 1, southeast concourse', walkMinutes: 6, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }],
  },
  {
    id: 'first-aid-nw', name: 'First Aid NW', category: 'first_aid', x: 0.372, y: 0.365,
    description: 'EMTs on site. Any usher or staff member can call them to you.',
    location: 'Level 3, northwest concourse', walkMinutes: 4, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }],
  },
  {
    id: 'pedestrian-ramp', name: 'Pedestrian Ramp', category: 'accessible', x: 0.556, y: 0.492,
    description: 'The stadium’s one pedestrian ramp. It reaches every level except Level 7.',
    location: 'Southeast side, behind the end zone', walkMinutes: 7, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'ramp', tone: 'note' }],
  },
  {
    id: 'lactation-suite', name: 'Lactation Suite', category: 'restroom', x: 0.417, y: 0.460,
    description: 'Private Mamava lactation pod. Family restrooms are on every level.',
    location: 'Level 4, south', walkMinutes: 6, wait: 'short', accessible: false,
    tags: [{ id: 'family_room', tone: 'note' }],
  },
  {
    id: 'rideshare-kareem', name: 'Rideshare Drop-off', category: 'parking', x: 0.367, y: 0.212,
    description: 'Uber, Lyft and taxi drop-off. Pick-up is at Kareem Court and Manchester Boulevard.',
    location: 'Kareem Court, between Pincay Drive and Manchester Boulevard', walkMinutes: 10, wait: 'long', accessible: false,
    tags: [{ id: 'rideshare', tone: 'note' }, { id: 'busy_before_events', tone: 'note' }],
  },
  {
    id: 'accessible-drop-off', name: 'Accessible Drop-off', category: 'parking', x: 0.274, y: 0.381,
    description: 'Drop-off and pick-up for guests with disabilities. Come in from northbound Prairie Avenue via Arbor Vitae Street.',
    location: 'District Drive, between Champions Way and Touchdown Drive', walkMinutes: 8, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }],
  },
  {
    id: 'brown-zone', name: 'Brown Zone', category: 'parking', x: 0.291, y: 0.285,
    description: 'Parking closest to Entries 1–5 and 12. ADA stalls in every lot, first come, first served.',
    location: '3919 Pincay Drive', walkMinutes: 9, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'permit_needed', tone: 'note' }],
  },
  {
    id: 'blue-zone', name: 'Blue Zone', category: 'parking', x: 0.310, y: 0.530,
    description: 'Parking closest to Entries 7 and 8. ADA stalls in every lot, first come, first served.',
    location: '1100 Prairie Avenue', walkMinutes: 11, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'permit_needed', tone: 'note' }],
  },
  {
    id: 'orange-zone', name: 'Orange Zone', category: 'parking', x: 0.585, y: 0.415,
    description: 'Parking closest to Entries 10, 11 and 12. ADA stalls in every lot, first come, first served.',
    location: '3695 Pincay Drive', walkMinutes: 10, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'permit_needed', tone: 'note' }],
  },
];

// Crypto.com Arena. Sources (read 2026-11-15):
//   https://www.cryptoarena.com/a-z-guide
//   https://www.cryptoarena.com/accessibility
//   https://www.cryptoarena.com/plan-your-visit/getting-here
//   https://www.cryptoarena.com/plan-your-visit/getting-here/public-transportation
// "North" is the Chick Hearn Ct. (11th St.) side and east is Figueroa St., following the downtown
// street grid (it runs about 38° off true north). Georgia St. is the west side. The guides give
// aisles, not sides, so concourse pins go round the ring in aisle order, roughly. The A-Z guide puts
// upper Guest Services at U6; the accessibility page says aisle 5 (U6 used here).
const CRYPTO_ARENA: Template[] = [
  {
    id: 'kobe-bryant-entrance', name: 'Kobe Bryant Entrance', category: 'gate', x: 0.145, y: 0.195,
    description: 'Main entrance for all tickets. GA floor tickets enter here.',
    location: 'Chick Hearn Ct. (11th St.) at Georgia St.', walkMinutes: 5, wait: 'long', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'wheelchair_escort', tone: 'note' }, { id: 'bag_check', tone: 'note' }],
  },
  {
    id: 'star-plaza-entrance', name: 'Star Plaza Entrance', category: 'gate', x: 0.855, y: 0.195,
    description: 'Main entrance for all tickets, between the Box Office and Team LA Store.',
    location: 'Chick Hearn Ct. (11th St.) at Figueroa St.', walkMinutes: 4, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'wheelchair_escort', tone: 'note' }, { id: 'busy_before_events', tone: 'note' }],
  },
  {
    id: 'figueroa-entrance', name: 'Figueroa Entrance', category: 'gate', x: 0.855, y: 0.805,
    description: 'Main entrance for all tickets. Ask here for a free wheelchair escort.',
    location: '12th St. at Figueroa St.', walkMinutes: 6, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'wheelchair_escort', tone: 'note' }],
  },
  {
    id: 'guest-services-m12', name: 'Guest Services M12', category: 'info', x: 0.875, y: 0.425,
    description: 'Questions, lost items, assistive listening, sensory bags and weighted lap pads (ID needed).',
    location: 'Main Concourse, across from aisle M12', walkMinutes: 3, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'sensory_kits', tone: 'note' }, { id: 'assistive_listening', tone: 'note' }, { id: 'lost_items', tone: 'note' }],
  },
  {
    id: 'guest-services-u6', name: 'Guest Services U6', category: 'info', x: 0.725, y: 0.170,
    description: 'Questions, lost items, sensory bags and lap pads. Ask here for the Sensory Pod code.',
    location: 'Upper Concourse, across from aisle U6', walkMinutes: 6, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'sensory_kits', tone: 'note' }, { id: 'lost_items', tone: 'note' }],
  },
  {
    id: 'first-aid-m3', name: 'First Aid M3', category: 'first_aid', x: 0.375, y: 0.170,
    description: 'EMTs at every event, with a quiet area inside.',
    location: 'Main Concourse, across from aisle M3', walkMinutes: 4, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'quiet_room', tone: 'note' }],
  },
  {
    id: 'first-aid-u22', name: 'First Aid U22', category: 'first_aid', x: 0.575, y: 0.835,
    description: 'EMTs at every event, with a quiet area inside.',
    location: 'Upper Concourse, across from aisle U22', walkMinutes: 8, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'quiet_room', tone: 'note' }],
  },
  {
    id: 'sensory-pod', name: 'Sensory Pod', category: 'accessible', x: 0.550, y: 0.170,
    description: 'Quiet pod for one or two guests, open during every event. Guest Services has the door code.',
    location: 'Upper Concourse, across from aisle 3', walkMinutes: 7, wait: 'none', accessible: false,
    tags: [{ id: 'sensory_room', tone: 'note' }],
  },
  {
    id: 'restroom-m23', name: 'Restroom M23', category: 'restroom', x: 0.400, y: 0.835,
    description: 'All-gender restroom with a changing table. Every restroom is wheelchair accessible.',
    location: 'Main Concourse, across from aisle M23', walkMinutes: 5, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'changing_table', tone: 'note' }],
  },
  {
    id: 'restroom-u31', name: 'Restroom U31', category: 'restroom', x: 0.125, y: 0.450,
    description: 'All-gender restroom with a changing table. Every restroom is wheelchair accessible.',
    location: 'Upper Concourse, across from aisle U31', walkMinutes: 9, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'changing_table', tone: 'note' }],
  },
  {
    id: 'rideshare-chick-hearn', name: 'Chick Hearn Rideshare', category: 'parking', x: 0.225, y: 0.060,
    description: 'Rideshare drop-off and pick-up in the white zone (eastbound).',
    location: 'Chick Hearn Ct., between L.A. Live Way and Georgia St.', walkMinutes: 7, wait: 'long', accessible: false,
    tags: [{ id: 'rideshare', tone: 'note' }, { id: 'busy_before_events', tone: 'note' }],
  },
  {
    id: 'rideshare-figueroa', name: 'Figueroa Rideshare', category: 'parking', x: 0.950, y: 0.655,
    description: 'Rideshare drop-off and pick-up in the white zone (southbound).',
    location: 'Figueroa St., between 12th St. and Pico Blvd.', walkMinutes: 8, wait: 'short', accessible: false,
    tags: [{ id: 'rideshare', tone: 'note' }],
  },
  {
    id: 'west-garage-lot-w', name: 'West Garage (Lot W)', category: 'parking', x: 0.045, y: 0.350,
    description: 'Arena garage, entered from Chick Hearn Ct. or Georgia St.',
    location: '1005 Chick Hearn Ct.', walkMinutes: 9, wait: 'none', accessible: false,
    tags: [],
  },
];

// Intuit Dome. Sources (read 2026-11-15, rechecked 2026-11-18):
//   https://www.intuitdome.com/about/a-z-guide
//   https://www.intuitdome.com/about/faq
//   https://www.intuitdome.com/plan-your-visit/know-before-you-go
//   https://www.intuitdome.com/plan-your-visit/parking-information
//   https://www.intuitdome.com/plan-your-visit/venue-map (exterior image: plaza north-west of the
//   dome on Century Blvd., West Garage across Prairie Ave., East Garage to the east)
// Indoor pins sit where the official seating chart puts their section when it's laid over the dome
// on the exterior map (the court runs east-west, The Wall is the east end): Main 6 north-west,
// Terrace 18 and Terrace Wall 16 on the east outer ring, Terrace 27 in the south block, Wall 19 by
// the east tunnel. The Answers Portal and Main 6 services sit by the plaza entrance (the GameFace
// lane is "nearest the Answers Portal"). "Left of the Main Entrance" is read facing it from the
// plaza. The sensory room's and the elevators' spots aren't published (`approximate`: the pin is a
// placeholder and there's no route; the card says to ask an Arena Host).
// Elevators reach every level, so indoor rooms count as accessible unless the guide says otherwise.
const INTUIT_DOME: Template[] = [
  {
    id: 'main-entrance', name: 'Main Entrance', category: 'gate', x: 0.307, y: 0.542,
    description: 'GameFace ID lane on the left, Identity Pass lane on the right; for accessible entry, Identity Pass holders tap in at the Answers Portal. Bags up to 10×6×2 in. (medical bags up to 14×14×6). Free mobility help from security to your seat.',
    location: 'On the plaza, off Century Blvd. and Prairie Ave.', walkMinutes: 4, wait: 'long', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'wheelchair_escort', tone: 'note' }, { id: 'bag_check', tone: 'note' }, { id: 'busy_before_events', tone: 'note' }],
  },
  {
    id: 'vip-entrance', name: 'VIP Entrance', category: 'gate', x: 0.359, y: 0.535,
    description: 'For suite, club and floor tickets (they can also use the Main Entrance).',
    location: 'Left of the Main Entrance', walkMinutes: 5, wait: 'none', accessible: false,
    tags: [{ id: 'premium_access', tone: 'note' }],
  },
  {
    id: 'wall-entrance', name: 'The Wall Entrance', category: 'gate', x: 0.411, y: 0.528,
    description: 'For tickets in The Wall (they can also use the Main Entrance).',
    location: 'Left of the Main Entrance, past the VIP Entrance', walkMinutes: 6, wait: 'short', accessible: false,
    tags: [],
  },
  {
    id: 'answers-portal-main', name: 'Answers Portal Main', category: 'info', x: 0.333, y: 0.616,
    description: 'Guest services: lost and found, free assisted listening (photo ID held), sensory bags (ID held) and OneCourt devices.',
    location: 'Main Level, near section Main 6', walkMinutes: 3, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'assistive_listening', tone: 'note' }, { id: 'sensory_kits', tone: 'note' }, { id: 'wheelchair_escort', tone: 'note' }, { id: 'lost_items', tone: 'note' }],
  },
  {
    id: 'answers-portal-terrace', name: 'Answers Portal Terrace', category: 'info', x: 0.535, y: 0.765,
    description: 'Guest services: lost and found, free assisted listening (photo ID held) and OneCourt devices.',
    location: 'Terrace Level, near section Terrace 18', walkMinutes: 9, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'assistive_listening', tone: 'note' }, { id: 'wheelchair_escort', tone: 'note' }, { id: 'lost_items', tone: 'note' }],
  },
  {
    id: 'first-aid-main', name: 'First Aid Main', category: 'first_aid', x: 0.350, y: 0.668,
    description: 'Trained EMTs at all events.',
    location: 'Main Level concourse, Main 6', walkMinutes: 4, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }],
  },
  {
    id: 'first-aid-terrace', name: 'First Aid Terrace', category: 'first_aid', x: 0.376, y: 0.895,
    description: 'Trained EMTs at all events.',
    location: 'Terrace Level concourse, Terrace 27', walkMinutes: 10, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }],
  },
  {
    id: 'first-aid-floor', name: 'First Aid Floor', category: 'first_aid', x: 0.480, y: 0.760,
    description: 'Trained EMTs at all events.',
    location: 'Floor Level, under Wall 19 by the east tunnel', walkMinutes: 7, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }],
  },
  {
    id: 'sensory-room', name: 'Sensory Room', category: 'accessible', x: 0.495, y: 0.593, approximate: true,
    description: 'The private Kaiser Permanente Sensory Room. Sensory bags (headphones, fidget toys) are at the Answers Portal by Main 6; ID needed.',
    location: 'Ask an Arena Host for the way', walkMinutes: 6, wait: 'none', accessible: false,
    tags: [{ id: 'sensory_room', tone: 'note' }, { id: 'sensory_kits', tone: 'note' }],
  },
  {
    id: 'elevators', name: 'Elevators', category: 'accessible', x: 0.282, y: 0.600, approximate: true,
    description: 'Elevators go from the Main Entrance to every level, and escalators link the Main and Terrace levels in the main lobby. Guests with limited mobility go first.',
    location: 'Ask an Arena Host for the nearest one', walkMinutes: 2, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'escalators', tone: 'note' }],
  },
  {
    id: 'infant-care-room', name: 'Infant Care Room', category: 'restroom', x: 0.378, y: 0.602,
    description: 'A private room for infant care. Universal restrooms are all around the arena.',
    location: 'Main Level, Main 6', walkMinutes: 4, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'family_room', tone: 'note' }, { id: 'changing_table', tone: 'note' }],
  },
  {
    id: 'infant-care-terrace', name: 'Infant Care Room Terrace', category: 'restroom', x: 0.548, y: 0.690,
    description: 'A private room for infant care. Every restroom also has a baby changing station.',
    location: 'Terrace Level, Terrace Wall 16', walkMinutes: 9, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'family_room', tone: 'note' }, { id: 'changing_table', tone: 'note' }],
  },
  {
    id: 'mobility-hub', name: 'Mobility Hub', category: 'parking', x: 0.917, y: 0.648,
    description: 'The only rideshare drop-off and pick-up. Also taxis, family drop-off and free shuttles (ADA vans available).',
    location: 'East Garage, level 1 (3700 W Century Blvd.)', walkMinutes: 11, wait: 'long', accessible: false,
    tags: [{ id: 'rideshare', tone: 'note' }, { id: 'busy_before_events', tone: 'note' }],
  },
  {
    id: 'east-garage', name: 'East Garage', category: 'parking', x: 0.914, y: 0.407,
    description: 'Standard parking; buy a pass ahead. Accessible spaces can be bought with a parking pass, first come, first served.',
    location: '3665 W 102nd St (entrance on 102nd St.)', walkMinutes: 12, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'pass_needed', tone: 'note' }],
  },
  {
    id: 'west-garage', name: 'West Garage', category: 'parking', x: 0.125, y: 0.505,
    description: 'VIP parking across Prairie Ave.; buy a pass ahead. Accessible spaces can be bought with a parking pass, first come, first served.',
    location: '10117 S Prairie Ave (entrance on Prairie Ave.)', walkMinutes: 8, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'pass_needed', tone: 'note' }],
  },
];

export function getVenue(id: string | undefined): Venue | undefined {
  return VENUES.find(v => v.id === id);
}

const VENUE_FACILITIES: Readonly<Record<string, Template[]>> = {
  sofi: SOFI,
  'crypto-arena': CRYPTO_ARENA,
  'intuit-dome': INTUIT_DOME,
};

const built = new Map<string, Facility[]>();

/** The venue's facilities (none for an unknown venue); the same array every call (don't sort it in place). */
export function facilitiesFor(venueId: string): Facility[] {
  const cached = built.get(venueId);
  if (cached) return cached;
  if (!Object.prototype.hasOwnProperty.call(VENUE_FACILITIES, venueId)) return [];
  const list = VENUE_FACILITIES[venueId].map(f => ({ ...f, venueId }));
  built.set(venueId, list);
  return list;
}

export function getFacility(venueId: string, facilityId: string | undefined): Facility | undefined {
  return facilitiesFor(venueId).find(f => f.id === facilityId);
}

/**
 * Text as search compares it: lower case, without accents, with Arabic and Persian digits as 0-9,
 * Arabic ي/ك as the Persian ی/ک, and curly apostrophes straight, so what people type on their own
 * keyboard still matches.
 * e.g. searchKey('Objets Trouvés') → 'objets trouves'; searchKey('البوابة ٢') → 'البوابة 2'; searchKey('Men’s') → "men's"
 */
export function searchKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06f0))
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[‘’ʼ]/g, "'")
    .toLowerCase();
}

const searchWords = (query: string) => searchKey(query).split(/\s+/).filter(Boolean);

/** Venues whose name, address or events (in English or the app language) contain every word of the query (see searchKey). */
export function searchVenues(query: string, venues: Venue[] = VENUES, t: VenueT = venueT()): Venue[] {
  const words = searchWords(query);
  if (!words.length) return venues;
  return venues.filter(v => {
    const hay = searchKey(`${v.name} ${v.address} ${eventsLabel(v, venueT('en'), 'en')} ${eventsLabel(v, t)}`);
    return words.every(w => hay.includes(w));
  });
}

/**
 * "Accessibility" also matches any facility that is accessible, not only the services desk, and
 * "Lost & Found" any desk that takes lost items (a guest services desk with the `lost_items` tag).
 * A sponsored stand only ever matches its own category (food): an ad never answers an
 * accessibility or safety filter, though its page keeps the wheelchair badge.
 */
export function matchesCategory(f: Facility, category: FacilityCategory | null): boolean {
  if (!category) return true;
  if (f.sponsor) return f.category === category;
  return f.category === category
    || (category === 'accessible' && f.accessible)
    || (category === 'lost_found' && f.tags.some(tag => tag.id === 'lost_items'));
}

/** Words people search for that no label says, in English (labels cover every language). */
const SEARCH_ALIASES: Partial<Record<FacilityCategory, string>> = {
  gate: 'entrance entry door',
  restroom: 'bathroom toilet washroom wc',
  first_aid: 'medical doctor nurse emt',
  accessible: 'wheelchair disability disabled',
  parking: 'car garage',
};

/**
 * What search compares a facility against: name, description, location, category and tag labels,
 * in English and in `t`'s language. A sponsored stand only has its own name, brand, offer and
 * description plus its category's words, never tag or accessibility words, so an ad never answers
 * "wheelchair" or "first aid".
 */
function searchText(f: Facility, t: VenueT, en: VenueT): string {
  const category = `${categoryLabel(f.category, en)} ${categoryLabel(f.category, t)} ${SEARCH_ALIASES[f.category] ?? ''}`;
  if (f.sponsor) {
    return searchKey(`${f.name} ${f.description} ${f.sponsor.brand} ${f.sponsor.offer} ${facilityName(f, t)} ${facilityDescription(f, t)} ${facilityOffer(f, t)} ${category}`);
  }
  const labels = [
    category,
    ...f.tags.flatMap(tag => [tagLabel(tag, en), tagLabel(tag, t)]),
    f.accessible ? `${categoryLabel('accessible', en)} ${categoryLabel('accessible', t)} ${SEARCH_ALIASES.accessible}` : '',
  ];
  return searchKey(`${f.name} ${f.description} ${f.location} ${facilityName(f, t)} ${facilityDescription(f, t)} ${facilityLocation(f, t)} ${labels.join(' ')}`);
}

// Each facility's search text per language, built on its first search: the list searches again on
// every keystroke. Facilities are the same objects every call (facilitiesFor, venueFacilitiesFor).
const searchTexts = new WeakMap<Facility, Map<string, string>>();

function cachedSearchText(f: Facility, t: VenueT, en: VenueT): string {
  let texts = searchTexts.get(f);
  if (!texts) searchTexts.set(f, (texts = new Map()));
  const language = languageOf(t);
  let text = texts.get(language);
  if (text === undefined) texts.set(language, (text = searchText(f, t, en)));
  return text;
}

/**
 * Matches name, description, location, category and tag labels, in English and in `t`'s language
 * (see searchKey), so "restroom" finds the infant care room and "wheelchair" an escort desk.
 * Sponsored stands match only their own words (see searchText).
 */
export function searchFacilities(facilities: Facility[], query: string, category: FacilityCategory | null, t: VenueT = venueT()): Facility[] {
  const words = searchWords(query);
  if (!words.length) return facilities.filter(f => matchesCategory(f, category));
  const en = venueT('en');
  return facilities.filter(f => {
    if (!matchesCategory(f, category)) return false;
    const hay = cachedSearchText(f, t, en);
    return words.every(w => hay.includes(w));
  });
}
