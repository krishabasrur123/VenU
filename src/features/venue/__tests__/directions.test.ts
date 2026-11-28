import { describe, expect, it, jest } from '@jest/globals';

import i18n from '@/i18n';

import { routeFor, routeStart, startMarker } from '../directions';
import { contentSize, toScreen } from '../map-geometry';
import { facilitiesFor, getVenue } from '../mock';
import { mapAspect, venueMapFor } from '../venue-maps';

// mock.ts reaches reports.ts through labels, and reports.ts builds its store on AsyncStorage.
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: async () => null, setItem: async () => {} } }));

const sofi = venueMapFor(getVenue('sofi')!);
const facilities = facilitiesFor('sofi');
const nowhere = { venueId: 'sofi', facilityId: null };

describe('routeStart', () => {
  it('starts at the visitor\'s own spot when they set one here', () => {
    expect(routeStart(sofi, facilities, { venueId: 'sofi', facilityId: 'entry-8' }, 'sofi')).toEqual({ from: facilities.find(f => f.id === 'entry-8'), mine: true });
  });

  it('starts at the main way in otherwise, or when their spot is at another venue', () => {
    expect(routeStart(sofi, facilities, nowhere, 'sofi')?.from.id).toBe('entry-4');
    expect(routeStart(sofi, facilities, { venueId: 'crypto-arena', facilityId: 'star-plaza-entrance' }, 'sofi')).toMatchObject({ mine: false, from: { id: 'entry-4' } });
  });

  it('has nowhere to start at a venue without facilities', () => {
    expect(routeStart(sofi, [], nowhere, 'sofi')).toBeNull();
  });
});

describe('routeFor', () => {
  it('runs the dashed line from the visitor\'s spot to the facility\'s pin', () => {
    const content = contentSize(mapAspect(sofi), 390);
    const route = routeFor(sofi, facilities, { venueId: 'sofi', facilityId: 'entry-11' }, 'sofi', 'blue-zone', content)!;
    const from = facilities.find(f => f.id === 'entry-11')!;
    const to = facilities.find(f => f.id === 'blue-zone')!;
    expect(route).toMatchObject({ from, to, fromIsMine: true, here: false });
    expect(route.walk.line).toEqual({ x1: from.x * 390, y1: from.y * content.h, x2: to.x * 390, y2: to.y * content.h });
    // On screen, at any pan and zoom, the line's ends sit exactly on the two pins.
    const view = { s: 2.6, x: -180, y: -320 };
    const near = (a: { x: number; y: number }, x: number, y: number) => {
      expect(a.x).toBeCloseTo(x, 6);
      expect(a.y).toBeCloseTo(y, 6);
    };
    near(toScreen(from, content, view), view.x + view.s * route.walk.line.x1, view.y + view.s * route.walk.line.y1);
    near(toScreen(to, content, view), view.x + view.s * route.walk.line.x2, view.y + view.s * route.walk.line.y2);
  });

  it('heads the right way on the north-up map, with a plausible walk', () => {
    // Entry 4 (north-west of the bowl) to Entry 10 (south-east): south-east, a few minutes.
    const route = routeFor(sofi, facilities, nowhere, 'sofi', 'entry-10')!;
    expect(route.walk.heading).toBe('se');
    expect(route.walk.minutes).toBe(9); // as directions.ts's header says
  });

  it('says you\'re already there instead of drawing a line to yourself', () => {
    expect(routeFor(sofi, facilities, { venueId: 'sofi', facilityId: 'entry-3' }, 'sofi', 'entry-3')?.here).toBe(true);
  });

  it('has no route to an unknown facility', () => {
    expect(routeFor(sofi, facilities, nowhere, 'sofi', 'gate-99')).toBeNull();
  });
});

describe('startMarker', () => {
  it('says "You" only at a spot the visitor set', () => {
    const route = routeFor(sofi, facilities, { venueId: 'sofi', facilityId: 'entry-11' }, 'sofi', 'blue-zone');
    const at = facilities.find(f => f.id === 'entry-11')!;
    expect(startMarker(route)).toEqual({ kind: 'you', at, point: { x: at.x, y: at.y } });
  });

  it('tags the main way in "Start" (its pin stays) until they do', () => {
    const route = routeFor(sofi, facilities, nowhere, 'sofi', 'blue-zone');
    const at = facilities.find(f => f.id === 'entry-4')!;
    expect(startMarker(route)).toEqual({ kind: 'start', at, point: { x: at.x, y: at.y } });
  });

  it('marks nothing without a walk', () => {
    expect(startMarker(null)).toBeNull();
    expect(startMarker(routeFor(sofi, facilities, nowhere, 'sofi', 'entry-4'))).toBeNull();
  });
});

describe('directions strings', () => {
  it('say the walk and its steps in each language', () => {
    const es = i18n.getFixedT('es', 'venue');
    expect(es('directions.stepHead', { direction: es('directions.dir.se'), meters: '260' })).toBe('Ve hacia el sureste unos 260 m.');
    expect(i18n.getFixedT('ru', 'venue')('directions.steps', { count: 5, number: '5' })).toBe('около 5 шагов');
    expect(i18n.getFixedT('ar', 'venue')('directions.steps', { count: 2, number: '2' })).toBe('نحو خطوتين');
    // The arrival hint quotes the language's own "I'm here" button.
    expect(es('directions.fromArrival', { from: 'Entrada 4' })).toContain(`«${es('facility.imHere')}»`);
  });
});
