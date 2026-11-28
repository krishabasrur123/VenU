// Guest services phone numbers, each copied from the venue's own site (checked 2026-11-15).
// A venue with no confirmed number is left out, and "Call venue staff" hides there.
// e.g. venueContact('sofi') → { phone: '+14245419100', source: 'https://www.sofistadium.com/accessibility' }
import { Linking } from 'react-native';

export interface VenueContact {
  /** Dialable E.164 number, e.g. '+14245419100'. */
  phone: string;
  /** The official page that lists it. */
  source: string;
  /** A number to text instead, when the venue staffs one during events, e.g. SoFi's '+14245419222'. */
  text?: string;
}

export const VENUE_CONTACTS: Readonly<Record<string, VenueContact>> = {
  // Call "424-541-9100 between the hours of 11:00 am - 4:00 pm" (non-event days); on event days
  // "text (424) 541-9222 with a brief description of the assistance needed".
  sofi: { phone: '+14245419100', text: '+14245419222', source: 'https://www.sofistadium.com/accessibility' },
  // "Guest Services at (213) 742-7FAN (326)"
  'crypto-arena': { phone: '+12137427326', source: 'https://www.cryptoarena.com/general-info-faq' },
  // FAQ: "Please contact us via email, phone, or text (available during event days only).
  // Call: 1-888-311-0231 / Text: 310-282-5779" (the call number is also on its Customer Support page).
  'intuit-dome': { phone: '+18883110231', text: '+13102825779', source: 'https://www.intuitdome.com/about/faq' },
};

/** The venue's staff line, or null when no official number is known. */
export function venueContact(venueId: string): VenueContact | null {
  return Object.prototype.hasOwnProperty.call(VENUE_CONTACTS, venueId) ? VENUE_CONTACTS[venueId]! : null;
}

/** Opens a new text message, e.g. textMessage('+14245419222'). */
export function textMessage(number: string) {
  Linking.openURL(`sms:${number}`).catch(() => {
    // No messaging app (a desktop browser): nothing to open.
  });
}

/** Opens the phone dialer, e.g. dial('911') or dial('+14245419100'). */
export function dial(number: string) {
  Linking.openURL(`tel:${number}`).catch(() => {
    // No phone app (a desktop browser): nothing to open.
  });
}
