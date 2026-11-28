import { describe, expect, it, jest } from '@jest/globals';

import i18n from '@/i18n';
import { resources } from '@/i18n/locales';

import { categoriesAt, CATEGORIES } from '../categories';
import { routeFor, routeStart, walkFrom, walkFromStart, walkOrder } from '../directions';
import { categoryLabel, facilityMeta, withoutFinalStop } from '../labels';
import { pinsFor } from '../map-geometry';
import { facilitiesFor, getFacility, getVenue, matchesCategory, searchFacilities } from '../mock';
import { venueFacilitiesFor } from '../sponsors';
import { venueMapFor } from '../venue-maps';

// mock.ts reaches reports.ts through labels, and reports.ts builds its store on AsyncStorage.
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: async () => null, setItem: async () => {} } }));

const intuitMap = venueMapFor(getVenue('intuit-dome')!);
const intuit = facilitiesFor('intuit-dome');
const f = (id: string) => getFacility('intuit-dome', id)!;
const nowhere = { venueId: 'intuit-dome', facilityId: null };
const ids = (list: { id: string }[]) => list.map(x => x.id).sort();

describe('search', () => {
  it('finds facilities by their category and tag labels, not only their own text', () => {
    expect(ids(searchFacilities(intuit, 'restroom', null))).toEqual(['infant-care-room', 'infant-care-terrace']);
    expect(ids(searchFacilities(intuit, 'gate', null))).toEqual(['main-entrance', 'vip-entrance', 'wall-entrance']);
    expect(ids(searchFacilities(intuit, 'wheelchair', null))).toEqual(expect.arrayContaining(['answers-portal-main', 'answers-portal-terrace', 'main-entrance']));
    expect(ids(searchFacilities(intuit, 'lost', null))).toEqual(['answers-portal-main', 'answers-portal-terrace']);
  });

  it('knows a few everyday words no label uses', () => {
    expect(ids(searchFacilities(intuit, 'bathroom', null))).toEqual(['infant-care-room', 'infant-care-terrace']);
    expect(ids(searchFacilities(intuit, 'elevator', null))).toEqual(['elevators']);
  });

  it('matches the labels in the app language too', () => {
    const es = i18n.getFixedT('es', 'venue');
    expect(ids(searchFacilities(intuit, categoryLabel('restroom', es), null, es))).toEqual(['infant-care-room', 'infant-care-terrace']);
    const ar = i18n.getFixedT('ar', 'venue');
    expect(ids(searchFacilities(intuit, categoryLabel('first_aid', ar), null, ar))).toEqual(['first-aid-floor', 'first-aid-main', 'first-aid-terrace']);
  });

  it('still lists everything for an empty search', () => {
    expect(searchFacilities(intuit, '  ', null)).toHaveLength(intuit.length);
  });

  it('builds each facility\'s search text once per language, not again on every keystroke', () => {
    const es = i18n.getFixedT('es', 'venue');
    let calls = 0;
    const call = es as unknown as (...args: unknown[]) => string;
    const counted = Object.assign((...args: unknown[]) => { calls += 1; return call(...args); }, { lng: 'es' }) as unknown as typeof es;
    const fresh = intuit.map(x => ({ ...x })); // not yet searched
    expect(ids(searchFacilities(fresh, 'r', null, counted)).length).toBeGreaterThan(0);
    expect(calls).toBeGreaterThan(0);
    calls = 0;
    expect(ids(searchFacilities(fresh, categoryLabel('restroom', es), null, counted))).toEqual(['infant-care-room', 'infant-care-terrace']);
    expect(ids(searchFacilities(fresh, 'rampa', null, counted))).toEqual(ids(searchFacilities(intuit, 'rampa', null, es)));
    expect(calls).toBe(0);
  });
});

describe('category chips', () => {
  it('counts desks that take lost items as Lost & Found', () => {
    expect(matchesCategory(f('answers-portal-main'), 'lost_found')).toBe(true);
    expect(matchesCategory(f('main-entrance'), 'lost_found')).toBe(false);
    expect(ids(pinsFor(intuit, 'lost_found'))).toEqual(['answers-portal-main', 'answers-portal-terrace']);
  });

  it('hides a chip with nothing behind it at this venue, unless it is the one selected', () => {
    for (const venueId of ['sofi', 'crypto-arena', 'intuit-dome']) {
      const list = facilitiesFor(venueId);
      for (const c of categoriesAt(list)) expect({ venueId, c, empty: pinsFor(list, c).length === 0 }).toEqual({ venueId, c, empty: false });
    }
    expect(categoriesAt(intuit)).not.toContain('food'); // the spot picker: no food listed
    // The venue screen adds the sponsored stands, so its Food & Drinks chip shows them (and only them).
    const venueScreen = venueFacilitiesFor('intuit-dome');
    expect(categoriesAt(venueScreen)).toContain('food');
    expect(pinsFor(venueScreen, 'food').every(x => !!x.sponsor)).toBe(true);
    expect(categoriesAt(intuit)).toEqual(expect.arrayContaining(['gate', 'restroom', 'first_aid', 'lost_found', 'info', 'accessible', 'parking']));
    expect(categoriesAt(intuit, 'food')).toContain('food');
    expect(categoriesAt(intuit).every((c, i, all) => i === 0 || CATEGORIES.indexOf(all[i - 1]) < CATEGORIES.indexOf(c))).toBe(true);
  });
});

describe('walk times', () => {
  it('agree with the route panel for every facility, from the way in and from the visitor\'s spot', () => {
    for (const where of [nowhere, { venueId: 'intuit-dome', facilityId: 'first-aid-floor' }]) {
      for (const to of intuit) {
        const walk = walkFromStart(intuitMap, intuit, where, 'intuit-dome', to);
        const route = routeFor(intuitMap, intuit, where, 'intuit-dome', to.id);
        if (to.approximate) {
          expect(walk).toEqual({ kind: 'ask' });
          expect(route).toBeNull();
        } else if (route!.here) {
          expect(walk).toEqual({ kind: route!.fromIsMine ? 'mine' : 'start' });
        } else {
          expect({ id: to.id, walk }).toEqual({ id: to.id, walk: { kind: 'walk', minutes: route!.walk.minutes } });
        }
      }
    }
  });

  it('gives the same walks from a start found once (the venue screen\'s walkTo)', () => {
    for (const where of [nowhere, { venueId: 'intuit-dome', facilityId: 'first-aid-terrace' }]) {
      const start = routeStart(intuitMap, intuit, where, 'intuit-dome');
      for (const to of intuit) expect({ id: to.id, walk: walkFrom(intuitMap, start, to) }).toEqual({ id: to.id, walk: walkFromStart(intuitMap, intuit, where, 'intuit-dome', to) });
    }
  });

  it('calls the way in the start, not a walk to itself', () => {
    expect(walkFromStart(intuitMap, intuit, nowhere, 'intuit-dome', f('main-entrance'))).toEqual({ kind: 'start' });
    expect(facilityMeta(f('main-entrance'), i18n.getFixedT('en', 'venue'), { kind: 'start' })).toBe('Walks start here · Long wait');
    expect(facilityMeta(f('sensory-room'), i18n.getFixedT('en', 'venue'), { kind: 'ask' })).toBe('Spot not published · No wait');
    expect(facilityMeta(f('first-aid-main'), i18n.getFixedT('en', 'venue'), { kind: 'walk', minutes: 2 })).toBe('2 min walk · No wait');
  });

  it('sorts the start first and unpublished spots last', () => {
    const sorted = [...intuit].sort((a, b) => walkOrder(walkFromStart(intuitMap, intuit, nowhere, 'intuit-dome', a)) - walkOrder(walkFromStart(intuitMap, intuit, nowhere, 'intuit-dome', b)));
    expect(sorted[0].id).toBe('main-entrance');
    expect(ids(sorted.slice(-2))).toEqual(['elevators', 'sensory-room']);
  });

  it('calls the start spot the start even when its own spot isn\'t published', () => {
    // A venue whose way in is a placeholder pin: walks still start there, so it reads "Walks start here".
    const map = { ...intuitMap, arrival: 'elevators' };
    expect(walkFromStart(map, intuit, nowhere, 'intuit-dome', f('elevators'))).toEqual({ kind: 'start' });
    expect(walkFromStart(map, intuit, nowhere, 'intuit-dome', f('sensory-room'))).toEqual({ kind: 'ask' });
  });

  it('never starts a walk from a spot that isn\'t published', () => {
    expect(routeStart(intuitMap, intuit, { venueId: 'intuit-dome', facilityId: 'sensory-room' }, 'intuit-dome')).toEqual({ from: f('main-entrance'), mine: false });
  });
});

describe('new strings', () => {
  it('are translated in all 13 languages', () => {
    for (const lng of Object.keys(resources) as (keyof typeof resources)[]) {
      if (lng === 'en') continue;
      const v = resources[lng].venue;
      for (const [key, mine, en] of [
        ['walkStart', v.walkStart, resources.en.venue.walkStart],
        ['walkMine', v.walkMine, resources.en.venue.walkMine],
        ['walkAsk', v.walkAsk, resources.en.venue.walkAsk],
        ['noRoute', v.facility.noRoute, resources.en.venue.facility.noRoute],
        ['fromArrivalPlain', v.directions.fromArrivalPlain, resources.en.venue.directions.fromArrivalPlain],
      ]) {
        expect({ lng, key, ok: !!mine && mine !== en }).toEqual({ lng, key, ok: true });
      }
      expect(v.directions.fromArrivalPlain).toContain('{{from}}');
    }
  });
});

describe('route wording', () => {
  it('drops a location\'s own full stop before the step adds one', () => {
    expect(withoutFinalStop('Entrance on 102nd St.')).toBe('Entrance on 102nd St');
    expect(withoutFinalStop('东停车楼 1 层。')).toBe('东停车楼 1 层');
    expect(withoutFinalStop('Main Level, Main 6')).toBe('Main Level, Main 6');
    expect(withoutFinalStop('3665 W 102nd St (entrance on 102nd St.)')).toBe('3665 W 102nd St (entrance on 102nd St.)');
  });

  it('says "From Main Entrance." at Intuit Dome, without "the main way in"', () => {
    expect(intuitMap.arrivalNamedMain).toBe(true);
    expect(venueMapFor(getVenue('sofi')!).arrivalNamedMain).toBeFalsy();
    const en = i18n.getFixedT('en', 'venue');
    expect(en('directions.fromArrivalPlain', { from: 'Main Entrance' })).toBe('From Main Entrance. Somewhere else? Open that spot and tap “I’m here”.');
  });
});
