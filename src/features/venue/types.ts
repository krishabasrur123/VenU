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

export type VenueEvent = 'opening_ceremony' | 'swimming' | 'gymnastics' | 'basketball';

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
  | 'permit_needed'
  /** A paid parking pass (not a disability permit). */
  | 'pass_needed'
  | 'wheelchair_escort'
  | 'premium_access'
  | 'sensory_room'
  | 'assistive_listening'
  | 'lost_items'
  | 'changing_table';

/** Green "Accessible"-style tag, or an orange heads-up ("Busy before events"). */
export interface FacilityTag {
  id: FacilityTagId;
  tone: 'good' | 'note';
}

export type WaitLevel = 'none' | 'short' | 'long';

/**
 * A paid placement on a stand (./sponsors.ts): always shown labelled "Sponsored", with VenU's own
 * Sponsored icon and theme colours, never the brand's logo or colours.
 */
export interface FacilitySponsor {
  /** The brand as plain text, e.g. "Coca-Cola". A proper name, so never translated. */
  brand: string;
  /** English; screens show venue:facilityText.<id>.offer, e.g. "$1 off any Coca-Cola drink with VenU". */
  offer: string;
}

export interface Facility {
  /** Unique within its venue; used in the URL (/venue/sofi/entry-4). */
  id: string;
  venueId: string;
  name: string;
  category: FacilityCategory;
  /** English; screens show the translation in venue:facilityText.<id> when there is one. */
  description: string;
  /** Where to find it, e.g. "East entrance, by Lot C". Translated like `description`. */
  location: string;
  /** A stand-in walk time; screens show the walk from the route start instead (see walkFromStart). */
  walkMinutes: number;
  wait: WaitLevel;
  /** Step-free and wheelchair usable. Shows the blue wheelchair badge. */
  accessible: boolean;
  tags: FacilityTag[];
  /** Position on the venue's map image (./venue-maps.ts), from 0 to 1 across and down. */
  x: number;
  y: number;
  /**
   * The venue doesn't publish where it is, so the pin is only a placeholder: no walking route or
   * walk time, and the card says to ask staff instead.
   */
  approximate?: boolean;
  /** A photo of the spot, hotlinked from the venue's site; the pin card shows the category icon without one. */
  photo?: string;
  /** Set on sponsored stands only: they get the Sponsored pin, an offer and the promoted list card. */
  sponsor?: FacilitySponsor;
}
