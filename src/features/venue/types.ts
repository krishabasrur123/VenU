/** Venue tab data shapes. Mock data in ./mock.ts; reports in ./reports.ts. */

export type FacilityCategory =
  | 'gate'
  | 'restroom'
  | 'food'
  | 'first_aid'
  | 'lost_found'
  | 'info'
  | 'accessible'
  | 'parking';

export type VenueEvent = 'opening_ceremony' | 'swimming' | 'athletics' | 'football' | 'gymnastics' | 'basketball';

/** How the venue is drawn on the map: an open-air bowl or an indoor arena. */
export type VenueShape = 'bowl' | 'arena';

export interface Venue {
  id: string;
  name: string;
  address: string;
  /** What LA28 holds there; shown translated (venue:events.<id>). */
  events: VenueEvent[];
  shape: VenueShape;
}

/** Tag ids; each shows translated (venue:tags.<id>). */
export type FacilityTagId =
  | 'accessible'
  | 'stairs'
  | 'busy_before_events'
  | 'ramp'
  | 'bag_check'
  | 'rideshare'
  | 'escalators'
  | 'sensory_kits'
  | 'quiet_room'
  | 'family_room'
  | 'long_lines_halftime'
  | 'wheelchair_loans'
  | 'permit_needed';

/** Green "Accessible"-style tag, or an orange heads-up ("Busy before events"). */
export interface FacilityTag {
  id: FacilityTagId;
  tone: 'good' | 'note';
}

export type WaitLevel = 'none' | 'short' | 'long';

export interface Facility {
  /** Unique within its venue; used in the URL (/venue/sofi/gate-2). */
  id: string;
  venueId: string;
  name: string;
  category: FacilityCategory;
  /** English; screens show the translation in venue:facilityText.<id> when there is one. */
  description: string;
  /** Where to find it, e.g. "East entrance, by Lot C". Translated like `description`. */
  location: string;
  walkMinutes: number;
  wait: WaitLevel;
  /** Step-free and wheelchair usable. Shows the blue wheelchair badge. */
  accessible: boolean;
  tags: FacilityTag[];
  /** Position on the venue map, in the map's 400×400 coordinate space. */
  x: number;
  y: number;
}
