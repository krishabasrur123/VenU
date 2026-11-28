import { describe, expect, it, jest } from '@jest/globals';

import { resources } from '@/i18n/locales';

import { venueContact } from '../contacts';
import { facilitiesFor, getFacility } from '../mock';

// mock.ts reaches reports.ts through labels, and reports.ts builds its store on AsyncStorage.
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: async () => null, setItem: async () => {} } }));

const intuit = (id: string) => getFacility('intuit-dome', id) ?? (() => { throw new Error(id); })();
const LANGS = Object.keys(resources) as (keyof typeof resources)[];
type Row = { name?: string; description?: string; location?: string };
const text = (lng: keyof typeof resources, id: string) => (resources[lng].venue.facilityText as Record<string, Row>)[id];

// Checked against the official A-Z guide, FAQ and parking pages (2026-11-18), with the seating chart
// laid over the exterior map (see the INTUIT_DOME comment in mock.ts).
describe('Intuit Dome facilities', () => {
  it('puts the pins where the seating chart puts their sections', () => {
    const at = (id: string) => [intuit(id).x, intuit(id).y];
    expect(at('first-aid-floor')).toEqual([0.48, 0.76]); // under Wall 19 by the east tunnel
    expect(at('answers-portal-terrace')).toEqual([0.535, 0.765]); // Terrace 18, east outer ring
    expect(at('first-aid-terrace')).toEqual([0.376, 0.895]); // Terrace 27, south block
    expect(at('first-aid-main')).toEqual([0.35, 0.668]); // Main 6
    expect(at('infant-care-terrace')).toEqual([0.548, 0.69]); // Terrace Wall 16
  });

  it('marks the spots the venue doesn’t publish as approximate, and only those', () => {
    expect(facilitiesFor('intuit-dome').filter(f => f.approximate).map(f => f.id).sort()).toEqual(['elevators', 'sensory-room']);
    expect(facilitiesFor('sofi').some(f => f.approximate)).toBe(false);
  });

  it('lists what each desk offers', () => {
    const tags = (id: string) => intuit(id).tags.map(t => t.id);
    expect(tags('answers-portal-main')).toEqual(expect.arrayContaining(['lost_items', 'sensory_kits', 'wheelchair_escort', 'assistive_listening']));
    expect(tags('answers-portal-terrace')).toEqual(expect.arrayContaining(['lost_items', 'wheelchair_escort']));
    expect(tags('main-entrance')).toContain('bag_check');
    expect(tags('infant-care-room')).toEqual(expect.arrayContaining(['accessible', 'changing_table']));
    expect(intuit('infant-care-room').accessible).toBe(true);
    for (const garage of ['east-garage', 'west-garage']) {
      expect(tags(garage)).toContain('pass_needed');
      expect(tags(garage)).not.toContain('permit_needed'); // reads as a disability permit; Intuit sells a parking pass
    }
  });

  it('carries every changed fact into all 13 languages', () => {
    const facts: [string, keyof Row, RegExp][] = [
      ['east-garage', 'location', /3665/],
      ['west-garage', 'location', /10117/],
      ['mobility-hub', 'location', /3700/],
      ['main-entrance', 'description', /(10|۱۰)×(6|۶)×(2|۲)/],
      ['answers-portal-terrace', 'description', /OneCourt/],
      ['sensory-room', 'description', /Main 6/],
      ['infant-care-terrace', 'location', /Terrace Wall 16/],
    ];
    for (const lng of LANGS) {
      for (const [id, field, fact] of facts) {
        expect({ lng, id, field, ok: fact.test(text(lng, id)?.[field] ?? '') }).toEqual({ lng, id, field, ok: true });
      }
    }
  });

  it('translates the changed and new text (no English left in other languages)', () => {
    const changed = ['main-entrance', 'vip-entrance', 'wall-entrance', 'answers-portal-main', 'answers-portal-terrace', 'sensory-room', 'mobility-hub', 'east-garage', 'west-garage', 'infant-care-terrace', 'elevators'];
    for (const lng of LANGS.filter(l => l !== 'en')) {
      for (const id of changed) {
        expect({ lng, id, same: text(lng, id).description === text('en', id).description }).toEqual({ lng, id, same: false });
      }
      expect({ lng, same: resources[lng].venue.tags.pass_needed === resources.en.venue.tags.pass_needed }).toEqual({ lng, same: false });
    }
  });

  it('has the event-day text line from the FAQ', () => {
    expect(venueContact('intuit-dome')).toEqual({ phone: '+18883110231', text: '+13102825779', source: 'https://www.intuitdome.com/about/faq' });
  });
});
