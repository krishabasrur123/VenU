/**
 * Mock LA28 venues and their facilities, until the venue data lives in Supabase.
 * SoFi Stadium, Crypto.com Arena and Intuit Dome list what each venue's own guest guide names
 * (entries, guest services, first aid, sensory spaces, drop-off, parking), so names match the
 * official map and signs.
 *
 * - Pins (`x`, `y`, 0 to 1) are placed by hand on the venue's map (./venue-maps.ts): SoFi's on the
 *   numbered entries and lots of its parking zones map, or on the icons of its Level 3 and Level 6
 *   concourse maps for the spots inside (`layer`), Intuit Dome's on its exterior map, and
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

// SoFi Stadium. Sources (read 2026-11-15, rechecked 2026-11-28):
//   https://www.sofistadium.com/plan-your-visit/a-z-guide (entries, first aid, ramp, elevators,
//     restrooms, water, nursing, adult changing station, rideshare, taxis)
//   https://www.sofistadium.com/plan-your-visit/accessibility (podiums, sensory spaces, assistive
//     listening, device storage, elevator priority)
//   https://www.sofistadium.com/plan-your-visit/stadium-policies (clear bags, service animals)
//   https://www.sofistadium.com/plan-your-visit/parking-and-transportation (zones and their entry
//     addresses, Metro C/K Line shuttle, accessible courtesy shuttle)
//   https://www.sofistadium.com/plan-your-visit/parking-and-transportation/accessible-parking
//     (closest zone per entry, ADA drop-off on District Dr.; the FAQ on the parking page says to use
//     the Orange zone entry instead, but the accessible parking page gives the full route, so it wins)
//   https://www.sofistadium.com/plan-your-visit/parking-and-transportation/rideshare
//   https://www.sofistadium.com/plan-your-visit/maps (the interactive Mappedin map; not used for pins)
// Layers (./venue-maps.ts): 'outside' is the parking zones map; 'level-3' and 'level-6' are SoFi's
// own concourse maps. Pins sit on the marker the map draws for them:
// - Outside: entries on their numbered circles (Entry 6 on 6A, 8 on 8A, 9 on 9A of 9A to 9D; Entry
//   2 a hair east of its circle, to keep clear of Entry 3). The accessibility podiums are "inside"
//   Entries 4, 8 and 10, so their pins sit just past each entry towards the bowl. Zones on their lot
//   labels (Brown on Lot C, Blue on Lot N, Orange on Lot F, Green on Lot A, Purple on Lot L), the
//   drop-off on District Dr. between Champions Way and Touchdown Dr., rideshare on Kareem Ct.
// - Level 3: Guest Services (ⓘ), first aid (+), the two sensory rooms (SR), elevators, the ramp and
//   restrooms on their icons. Level 6: first aid, Guest Services, restrooms and hydration stations.
// - Not published, so `approximate` (placeholder pin, no route, "ask staff"): First Aid NW (the A-Z
//   guide lists one on Level 3 NW, the Level 3 map shows only NE), First Aid Level 1 (no Level 1
//   map; pinned on Level 3), the lactation suites (by level only) and the service animal relief area.
// Lost and found is at the Guest Services on your seat's level. Accessible = step-free or reached by
// the elevators ("elevators and escalators reach every single level").
const SOFI: Template[] = [
  {
    id: 'entry-1', name: 'Entry 1', category: 'gate', x: 0.414, y: 0.313,
    description: 'North entrance. Clear bags up to 12×6×12 in., or a small bag up to 4.5×6.5 in. Every entry has an accessible path and free wheelchair escorts.',
    location: 'North side, on Touchdown Drive', walkMinutes: 5, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'wheelchair_escort', tone: 'note' }, { id: 'bag_check', tone: 'note' }],
  },
  {
    id: 'entry-2', name: 'Entry 2', category: 'gate', x: 0.383, y: 0.321,
    description: 'North entrance, open until the end at football games. Clear bags up to 12×6×12 in., or a small bag up to 4.5×6.5 in.',
    location: 'North side, on Touchdown Drive', walkMinutes: 4, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'wheelchair_escort', tone: 'note' }, { id: 'bag_check', tone: 'note' }],
  },
  {
    id: 'entry-3', name: 'Entry 3', category: 'gate', x: 0.364, y: 0.325,
    description: 'North entrance, open until the end at football games. Every entry has an accessible path and free wheelchair escorts.',
    location: 'North side', walkMinutes: 5, wait: 'long', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'wheelchair_escort', tone: 'note' }, { id: 'bag_check', tone: 'note' }],
  },
  {
    id: 'entry-4', name: 'Entry 4', category: 'gate', x: 0.344, y: 0.330,
    description: 'North entrance with an accessibility podium and waiting chairs just inside. Clear bags up to 12×6×12 in., or a small bag up to 4.5×6.5 in.',
    location: 'North side', walkMinutes: 4, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'wheelchair_escort', tone: 'note' }, { id: 'bag_check', tone: 'note' }],
  },
  {
    id: 'entry-5', name: 'Entry 5', category: 'gate', x: 0.311, y: 0.345,
    description: 'North-west entrance, closest to the Green Zone (Lots A and B). Every entry has an accessible path and free wheelchair escorts.',
    location: 'North-west side', walkMinutes: 5, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'wheelchair_escort', tone: 'note' }, { id: 'bag_check', tone: 'note' }],
  },
  {
    id: 'entry-6', name: 'Entry 6', category: 'gate', x: 0.302, y: 0.394,
    description: 'West entrance for VIP and premium tickets, open until the end at football games.',
    location: 'West side', walkMinutes: 9, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'premium_access', tone: 'note' }],
  },
  {
    id: 'entry-7', name: 'Entry 7', category: 'gate', x: 0.383, y: 0.478,
    description: 'West entrance for VIP and premium tickets, open until the end at football games. Closest to the Blue Zone (Lot N).',
    location: 'West side, on Champions Way', walkMinutes: 9, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'premium_access', tone: 'note' }],
  },
  {
    id: 'entry-8', name: 'Entry 8', category: 'gate', x: 0.406, y: 0.491,
    description: 'South entrance with an accessibility podium and waiting chairs just inside. Entry 8B stays open until the end at football games.',
    location: 'South side', walkMinutes: 7, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'wheelchair_escort', tone: 'note' }, { id: 'bag_check', tone: 'note' }],
  },
  {
    id: 'entry-9', name: 'Entry 9', category: 'gate', x: 0.449, y: 0.502,
    description: 'South entrance (gates 9A to 9D), closest to the Purple Zone (Lots K and L). Every entry has an accessible path and free wheelchair escorts.',
    location: 'South side, by the lake', walkMinutes: 8, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'wheelchair_escort', tone: 'note' }, { id: 'bag_check', tone: 'note' }],
  },
  {
    id: 'entry-10', name: 'Entry 10', category: 'gate', x: 0.530, y: 0.444,
    description: 'South-east entrance with an accessibility podium and waiting chairs just inside. Entry 10B stays open until the end at football games.',
    location: 'South-east side, on Stadium Drive', walkMinutes: 6, wait: 'long', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'wheelchair_escort', tone: 'note' }, { id: 'busy_before_events', tone: 'note' }],
  },
  {
    id: 'entry-11', name: 'Entry 11', category: 'gate', x: 0.501, y: 0.400,
    description: 'East entrance for VIP and premium tickets, open until the end at football games.',
    location: 'East side', walkMinutes: 8, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'premium_access', tone: 'note' }],
  },
  {
    id: 'entry-12', name: 'Entry 12', category: 'gate', x: 0.472, y: 0.319,
    description: 'North-east entrance for VIP and premium tickets, open until the end at football games.',
    location: 'North-east side', walkMinutes: 6, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'premium_access', tone: 'note' }],
  },
  {
    id: 'podium-entry-4', name: 'Accessibility Podium 4', category: 'accessible', x: 0.356, y: 0.345,
    description: 'Mobility Ambassadors arrange a free wheelchair escort to your seat and back after the event. Waiting chairs. Wheelchairs can’t be lent for the event or brought to the parking lots.',
    location: 'Just inside Entry 4', walkMinutes: 4, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'wheelchair_escort', tone: 'note' }],
  },
  {
    id: 'podium-entry-8', name: 'Accessibility Podium 8', category: 'accessible', x: 0.414, y: 0.474,
    description: 'Mobility Ambassadors arrange a free wheelchair escort to your seat and back after the event. Waiting chairs. Wheelchairs can’t be lent for the event or brought to the parking lots.',
    location: 'Just inside Entry 8', walkMinutes: 7, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'wheelchair_escort', tone: 'note' }],
  },
  {
    id: 'podium-entry-10', name: 'Accessibility Podium 10', category: 'accessible', x: 0.512, y: 0.452,
    description: 'Mobility Ambassadors arrange a free wheelchair escort to your seat and back after the event. Waiting chairs. Wheelchairs can’t be lent for the event or brought to the parking lots.',
    location: 'Just inside Entry 10', walkMinutes: 6, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'wheelchair_escort', tone: 'note' }],
  },
  {
    id: 'rideshare-kareem', name: 'Rideshare Drop-off', category: 'parking', x: 0.367, y: 0.212,
    description: 'Uber, Lyft, taxis, buses and shuttles drop off on the northbound curb. Pick-up is at Kareem Court and Manchester Boulevard. By train: Metro C or K Line to LAX/Metro Transit Center, then the game-day shuttle from Bus Bay 8.',
    location: 'Kareem Court, between Pincay Drive and Manchester Boulevard', walkMinutes: 10, wait: 'long', accessible: false,
    tags: [{ id: 'rideshare', tone: 'note' }, { id: 'busy_before_events', tone: 'note' }],
  },
  {
    id: 'accessible-drop-off', name: 'Accessible Drop-off', category: 'parking', x: 0.257, y: 0.375,
    description: 'Drop-off and pick-up for guests with disabilities. Come in from northbound Prairie Avenue via Arbor Vitae Street; leave by Touchdown Drive.',
    location: 'District Drive, between Champions Way and Touchdown Drive', walkMinutes: 8, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }],
  },
  {
    id: 'brown-zone', name: 'Brown Zone', category: 'parking', x: 0.291, y: 0.285,
    description: 'Lots C and D, closest to Entries 1–5 and 12. ADA stalls (placard needed) in every lot, first come, first served. An accessible courtesy shuttle runs at select events.',
    location: '3919 Pincay Drive', walkMinutes: 9, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'permit_needed', tone: 'note' }],
  },
  {
    id: 'green-zone', name: 'Green Zone', category: 'parking', x: 0.212, y: 0.385,
    description: 'Lots A and B, closest to Entries 5 and 6. ADA stalls (placard needed) in every lot, first come, first served. An accessible courtesy shuttle runs at select events.',
    location: '800 Prairie Avenue', walkMinutes: 10, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'permit_needed', tone: 'note' }],
  },
  {
    id: 'blue-zone', name: 'Blue Zone', category: 'parking', x: 0.310, y: 0.530,
    description: 'Lot N, closest to Entries 7 and 8. ADA stalls (placard needed) in every lot, first come, first served. An accessible courtesy shuttle runs at select events.',
    location: '1100 Prairie Avenue', walkMinutes: 11, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'permit_needed', tone: 'note' }],
  },
  {
    id: 'purple-zone', name: 'Purple Zone', category: 'parking', x: 0.500, y: 0.600,
    description: 'Lots K and L, closest to Entry 9. ADA stalls (placard needed) in every lot, first come, first served. An accessible courtesy shuttle runs at select events.',
    location: '3801 West Century Boulevard', walkMinutes: 12, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'permit_needed', tone: 'note' }],
  },
  {
    id: 'orange-zone', name: 'Orange Zone', category: 'parking', x: 0.585, y: 0.415,
    description: 'Lots E to H, closest to Entries 10, 11 and 12. ADA stalls (placard needed) in every lot, first come, first served. An accessible courtesy shuttle runs at select events.',
    location: '3695 Pincay Drive', walkMinutes: 10, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'permit_needed', tone: 'note' }],
  },
  {
    id: 'service-animal-relief', name: 'Service Animal Relief Area', category: 'accessible', x: 0.335, y: 0.430, approximate: true,
    description: 'Service animals (dogs and miniature horses) are welcome; emotional support animals aren’t. Staff will show you the way to the relief area.',
    location: 'Ask Guest Experience staff for the way', walkMinutes: 8, wait: 'none', accessible: false,
    tags: [],
  },
  // Level 3 (200 VIP, Club and Premier sections).
  {
    id: 'guest-services-ne', name: 'Guest Services NE', category: 'info', layer: 'level-3', x: 0.768, y: 0.328,
    description: 'Lost items, free assistive listening and headphones (ID held), free sensory kits, mobility device storage and a sensory room.',
    location: 'Level 3, northeast concourse, by the Pechanga VIP Lobby', walkMinutes: 6, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'sensory_room', tone: 'note' }, { id: 'sensory_kits', tone: 'note' }, { id: 'assistive_listening', tone: 'note' }, { id: 'lost_items', tone: 'note' }],
  },
  {
    id: 'sensory-room-ne', name: 'Sensory Room NE', category: 'accessible', layer: 'level-3', x: 0.786, y: 0.324,
    description: 'A quiet room for a break from sound, lights and crowds, in 15-minute turns, first come, first served. Ask at the Guest Services desk beside it.',
    location: 'Level 3, inside the northeast Guest Services Center', walkMinutes: 6, wait: 'short', accessible: false,
    tags: [{ id: 'sensory_room', tone: 'note' }, { id: 'sensory_kits', tone: 'note' }],
  },
  {
    id: 'guest-services-n', name: 'Guest Services N', category: 'info', layer: 'level-3', x: 0.474, y: 0.196,
    description: 'Lost items, free assistive listening (ID held), free sensory kits, child locator wristbands and accessible seat moves.',
    location: 'Level 3, north concourse, by the Pro Shop', walkMinutes: 5, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'assistive_listening', tone: 'note' }, { id: 'sensory_kits', tone: 'note' }, { id: 'lost_items', tone: 'note' }],
  },
  {
    id: 'guest-services-se', name: 'Guest Services SE', category: 'info', layer: 'level-3', x: 0.742, y: 0.608,
    description: 'Lost items, free assistive listening (ID held), free sensory kits and directions.',
    location: 'Level 3, southeast, by the SoFi VIP Lobby', walkMinutes: 7, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'assistive_listening', tone: 'note' }, { id: 'sensory_kits', tone: 'note' }, { id: 'lost_items', tone: 'note' }],
  },
  {
    id: 'guest-services-sw', name: 'Guest Services SW', category: 'info', layer: 'level-3', x: 0.240, y: 0.626,
    description: 'Inside the Corona Beach Club. Lost items, free assistive listening and headphones (ID held), free sensory kits and a sensory room.',
    location: 'Level 3, southwest concourse', walkMinutes: 8, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'sensory_room', tone: 'note' }, { id: 'sensory_kits', tone: 'note' }, { id: 'lost_items', tone: 'note' }],
  },
  {
    id: 'sensory-room-sw', name: 'Sensory Room SW', category: 'accessible', layer: 'level-3', x: 0.252, y: 0.613,
    description: 'A quiet room for a break from sound, lights and crowds, in 15-minute turns, first come, first served. Ask at the Guest Services desk beside it.',
    location: 'Level 3, inside the southwest Guest Services Center', walkMinutes: 8, wait: 'short', accessible: false,
    tags: [{ id: 'sensory_room', tone: 'note' }, { id: 'sensory_kits', tone: 'note' }],
  },
  {
    id: 'first-aid-ne', name: 'First Aid NE', category: 'first_aid', layer: 'level-3', x: 0.740, y: 0.280,
    description: 'EMTs on site. Any usher or staff member can call them to you. You can also nurse a baby here in private.',
    location: 'Level 3, northeast concourse', walkMinutes: 6, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }],
  },
  {
    id: 'first-aid-nw', name: 'First Aid NW', category: 'first_aid', layer: 'level-3', x: 0.300, y: 0.290, approximate: true,
    description: 'EMTs on site. Any usher or staff member can call them to you. You can also nurse a baby here in private.',
    location: 'Level 3, northwest concourse; ask staff for the way', walkMinutes: 4, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }],
  },
  {
    id: 'first-aid-se', name: 'First Aid Level 1', category: 'first_aid', layer: 'level-3', x: 0.700, y: 0.690, approximate: true,
    description: 'EMTs on site. Any usher or staff member can call them to you. There are also first aid rooms on Levels 2, 3, 6 and 8.',
    location: 'Level 1 (event level), southeast concourse; ask staff for the way', walkMinutes: 6, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }],
  },
  {
    id: 'elevator-north', name: 'Elevator N', category: 'accessible', layer: 'level-3', x: 0.499, y: 0.233,
    description: 'Guests with disabilities ride first, with up to three companions (one at peak times). Elevators and escalators reach every level.',
    location: 'Level 3, north concourse, by section 207', walkMinutes: 5, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'escalators', tone: 'note' }],
  },
  {
    id: 'elevator-northwest', name: 'Elevator NW', category: 'accessible', layer: 'level-3', x: 0.373, y: 0.202,
    description: 'Guests with disabilities ride first, with up to three companions (one at peak times). Elevators and escalators reach every level.',
    location: 'Level 3, northwest concourse', walkMinutes: 4, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'escalators', tone: 'note' }],
  },
  {
    id: 'pedestrian-ramp', name: 'Pedestrian Ramp', category: 'accessible', layer: 'level-3', x: 0.791, y: 0.720,
    description: 'The stadium’s one pedestrian ramp. It reaches every level except Level 7.',
    location: 'Southeast side, behind the end zone', walkMinutes: 7, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'ramp', tone: 'note' }],
  },
  {
    id: 'restrooms-n', name: 'Restrooms N', category: 'restroom', layer: 'level-3', x: 0.547, y: 0.196,
    description: 'Every restroom is accessible and has a baby changing station. Family restrooms are on every level.',
    location: 'Level 3, north concourse, near section 205', walkMinutes: 5, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'changing_table', tone: 'note' }, { id: 'long_lines_halftime', tone: 'note' }],
  },
  {
    id: 'restrooms-sw', name: 'Restrooms SW', category: 'restroom', layer: 'level-3', x: 0.233, y: 0.571,
    description: 'Every restroom is accessible and has a baby changing station. Family restrooms are on every level.',
    location: 'Level 3, southwest concourse, near section C223', walkMinutes: 8, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'changing_table', tone: 'note' }, { id: 'long_lines_halftime', tone: 'note' }],
  },
  // Level 6 (the Main Concourse, all 300 sections).
  {
    id: 'first-aid-se-6', name: 'First Aid SE', category: 'first_aid', layer: 'level-6', x: 0.733, y: 0.647,
    description: 'EMTs on site. Any usher or staff member can call them to you. You can also nurse a baby here in private.',
    location: 'Level 6, southeast concourse, near section 342', walkMinutes: 8, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }],
  },
  {
    id: 'first-aid-sw-6', name: 'First Aid SW', category: 'first_aid', layer: 'level-6', x: 0.245, y: 0.651,
    description: 'EMTs on site. Any usher or staff member can call them to you. You can also nurse a baby here in private.',
    location: 'Level 6, southwest concourse, near section 330', walkMinutes: 9, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }],
  },
  {
    id: 'guest-services-ne-6', name: 'Guest Services Level 6 NE', category: 'info', layer: 'level-6', x: 0.790, y: 0.333,
    description: 'Lost items, free assistive listening (ID held), free sensory kits and accessible seat moves.',
    location: 'Level 6, northeast, by the Pechanga VIP Lobby', walkMinutes: 7, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'assistive_listening', tone: 'note' }, { id: 'sensory_kits', tone: 'note' }, { id: 'lost_items', tone: 'note' }],
  },
  {
    id: 'guest-services-se-6', name: 'Guest Services Level 6 SE', category: 'info', layer: 'level-6', x: 0.769, y: 0.596,
    description: 'Lost items, free assistive listening (ID held), free sensory kits and accessible seat moves.',
    location: 'Level 6, southeast, by the SoFi VIP Lobby', walkMinutes: 8, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'assistive_listening', tone: 'note' }, { id: 'sensory_kits', tone: 'note' }, { id: 'lost_items', tone: 'note' }],
  },
  {
    id: 'adult-changing', name: 'Adult Changing Station', category: 'restroom', layer: 'level-6', x: 0.268, y: 0.597,
    description: 'An adult changing station, near elevator 8. Ask a Guest Experience Representative if you can’t find it.',
    location: 'Level 6, near section 329', walkMinutes: 9, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'changing_table', tone: 'note' }],
  },
  {
    id: 'lactation-suite', name: 'Lactation Suites', category: 'restroom', layer: 'level-6', x: 0.420, y: 0.735, approximate: true,
    description: 'Private Mamava lactation suites with seating and power, on Level 4 South, Level 6 and Level 8. Any first aid room or family restroom works too.',
    location: 'Ask Guest Services for the nearest one', walkMinutes: 6, wait: 'short', accessible: false,
    tags: [{ id: 'family_room', tone: 'note' }],
  },
  {
    id: 'hydration-ne', name: 'Hydration Station NE', category: 'food', layer: 'level-6', x: 0.684, y: 0.244,
    description: 'Free filtered water. You can bring one empty, clear, non-metal reusable bottle up to 20 oz to fill here.',
    location: 'Level 6, northeast concourse, near section 304', walkMinutes: 6, wait: 'short', accessible: false,
    tags: [],
  },
  {
    id: 'hydration-sw', name: 'Hydration Station SW', category: 'food', layer: 'level-6', x: 0.275, y: 0.629,
    description: 'Free filtered water. You can bring one empty, clear, non-metal reusable bottle up to 20 oz to fill here.',
    location: 'Level 6, southwest concourse, near section 329', walkMinutes: 9, wait: 'short', accessible: false,
    tags: [],
  },
  {
    id: 'restrooms-nw', name: 'Restrooms NW', category: 'restroom', layer: 'level-6', x: 0.240, y: 0.321,
    description: 'Every restroom is accessible and has a baby changing station. Family restrooms are on every level.',
    location: 'Level 6, northwest concourse, near section 316', walkMinutes: 6, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'changing_table', tone: 'note' }, { id: 'long_lines_halftime', tone: 'note' }],
  },
  {
    id: 'restrooms-se', name: 'Restrooms SE', category: 'restroom', layer: 'level-6', x: 0.733, y: 0.673,
    description: 'Every restroom is accessible and has a baby changing station. Family restrooms are on every level.',
    location: 'Level 6, southeast concourse, near section 341', walkMinutes: 8, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'changing_table', tone: 'note' }, { id: 'long_lines_halftime', tone: 'note' }],
  },
];

// Crypto.com Arena. Sources (read 2026-11-15):
//   https://www.cryptoarena.com/a-z-guide
//   https://www.cryptoarena.com/accessibility
//   https://www.cryptoarena.com/plan-your-visit/getting-here
//   https://www.cryptoarena.com/plan-your-visit/getting-here/public-transportation
// "North" is the Chick Hearn Way (top) side and east is Figueroa St./Star Plaza (right), following
// the image compass. Georgia St. is the west (left) side. Pins are placed on the seating blueprint
// (1425×1104, assets/images/Crypto.com Arena Seating Blueprint.png). Entrance labels, Guest
// Services ⓘ, and restroom ♂♀ icons are printed directly on the image and used to place pins.
// Street-level pins (rideshare, garage) sit outside the arena oval at the matching edge.
const CRYPTO_ARENA: Template[] = [
  {
    // Labelled "KOBE BRYANT ENTRANCE" top-left of the image, white square marker.
    id: 'kobe-bryant-entrance', name: 'Kobe Bryant Entrance', category: 'gate', x: 0.215, y: 0.063,
    description: 'Main entrance for all tickets. GA floor tickets enter here.',
    location: 'Chick Hearn Ct. (11th St.) at Georgia St.', walkMinutes: 5, wait: 'long', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'wheelchair_escort', tone: 'note' }, { id: 'bag_check', tone: 'note' }],
  },
  {
    // Labelled "STAR PLAZA ENTRANCE" top-right, white square marker below "STAR PLAZA" heading.
    id: 'star-plaza-entrance', name: 'Star Plaza Entrance', category: 'gate', x: 0.800, y: 0.175,
    description: 'Main entrance for all tickets, between the Box Office and Team LA Store.',
    location: 'Chick Hearn Ct. (11th St.) at Figueroa St.', walkMinutes: 4, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'wheelchair_escort', tone: 'note' }, { id: 'busy_before_events', tone: 'note' }],
  },
  {
    // Labelled "FIGUEROA ST. ENTRANCE" bottom-centre, white square marker.
    id: 'figueroa-entrance', name: 'Figueroa Entrance', category: 'gate', x: 0.490, y: 0.950,
    description: 'Main entrance for all tickets. Ask here for a free wheelchair escort.',
    location: '12th St. at Figueroa St.', walkMinutes: 6, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'wheelchair_escort', tone: 'note' }],
  },
  {
    // "GUEST SERVICES" label with ⓘ icon on the left concourse near M12–M13.
    id: 'guest-services-m12', name: 'Guest Services M12', category: 'info', x: 0.155, y: 0.310,
    description: 'Questions, lost items, assistive listening, sensory bags and weighted lap pads (ID needed).',
    location: 'Main Concourse, across from aisle M12', walkMinutes: 3, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'sensory_kits', tone: 'note' }, { id: 'assistive_listening', tone: 'note' }, { id: 'lost_items', tone: 'note' }],
  },
  {
    // Upper concourse U6 — NE quadrant, outer ring near sections 320–322.
    id: 'guest-services-u6', name: 'Guest Services U6', category: 'info', x: 0.740, y: 0.185,
    description: 'Questions, lost items, sensory bags and lap pads. Ask here for the Sensory Pod code.',
    location: 'Upper Concourse, across from aisle U6', walkMinutes: 6, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'sensory_kits', tone: 'note' }, { id: 'lost_items', tone: 'note' }],
  },
  {
    // First Aid M3 — NW main concourse, near sections 313–315 / M13–M14 area.
    id: 'first-aid-m3', name: 'First Aid M3', category: 'first_aid', x: 0.265, y: 0.220,
    description: 'EMTs at every event, with a quiet area inside.',
    location: 'Main Concourse, across from aisle M3', walkMinutes: 4, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'quiet_room', tone: 'note' }],
  },
  {
    // First Aid U22 — south concourse, near sections 302–303 bottom.
    id: 'first-aid-u22', name: 'First Aid U22', category: 'first_aid', x: 0.430, y: 0.880,
    description: 'EMTs at every event, with a quiet area inside.',
    location: 'Upper Concourse, across from aisle U22', walkMinutes: 8, wait: 'none', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'quiet_room', tone: 'note' }],
  },
  {
    // Sensory Pod — upper concourse aisle 3, NW area near sections 315–316.
    id: 'sensory-pod', name: 'Sensory Pod', category: 'accessible', x: 0.340, y: 0.195,
    description: 'Quiet pod for one or two guests, open during every event. Guest Services has the door code.',
    location: 'Upper Concourse, across from aisle 3', walkMinutes: 7, wait: 'none', accessible: false,
    tags: [{ id: 'sensory_room', tone: 'note' }],
  },
  {
    // Restroom M23 — SE main concourse; ♂♀ icon visible near M25–M26 / sections 324–326.
    id: 'restroom-m23', name: 'Restroom M23', category: 'restroom', x: 0.845, y: 0.420,
    description: 'All-gender restroom with a changing table. Every restroom is wheelchair accessible.',
    location: 'Main Concourse, across from aisle M23', walkMinutes: 5, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'changing_table', tone: 'note' }],
  },
  {
    // Restroom U31 — west concourse; ♂♀ icon visible near M9 / sections 307–308.
    id: 'restroom-u31', name: 'Restroom U31', category: 'restroom', x: 0.108, y: 0.555,
    description: 'All-gender restroom with a changing table. Every restroom is wheelchair accessible.',
    location: 'Upper Concourse, across from aisle U31', walkMinutes: 9, wait: 'short', accessible: true,
    tags: [{ id: 'accessible', tone: 'good' }, { id: 'changing_table', tone: 'note' }],
  },
  {
    // Chick Hearn rideshare — north street, top-centre of image above the arena oval.
    id: 'rideshare-chick-hearn', name: 'Chick Hearn Rideshare', category: 'parking', x: 0.490, y: 0.025,
    description: 'Rideshare drop-off and pick-up in the white zone (eastbound).',
    location: 'Chick Hearn Ct., between L.A. Live Way and Georgia St.', walkMinutes: 7, wait: 'long', accessible: false,
    tags: [{ id: 'rideshare', tone: 'note' }, { id: 'busy_before_events', tone: 'note' }],
  },
  {
    // SW VIP Entrance labelled on the left edge — closest point for Figueroa rideshare zone.
    id: 'rideshare-figueroa', name: 'Figueroa Rideshare', category: 'parking', x: 0.038, y: 0.460,
    description: 'Rideshare drop-off and pick-up in the white zone (southbound).',
    location: 'Figueroa St., between 12th St. and Pico Blvd.', walkMinutes: 8, wait: 'short', accessible: false,
    tags: [{ id: 'rideshare', tone: 'note' }],
  },
  {
    // West Garage — left of the arena; "VIP" label area on the top-left of the image.
    id: 'west-garage-lot-w', name: 'West Garage (Lot W)', category: 'parking', x: 0.038, y: 0.200,
    description: 'Arena garage with designated disabled parking. Entered from Chick Hearn Ct. or Georgia St.',
    location: '1005 Chick Hearn Ct.', walkMinutes: 9, wait: 'none', accessible: false,
    tags: [{ id: 'accessible', tone: 'good' }],
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
