import { describe, expect, it, jest } from '@jest/globals';

import i18n from '@/i18n';
import { resources } from '@/i18n/locales';

import { venueContact } from '../contacts';
import { LEVEL_CHANGE_MINUTES, routeFor, startMarker, walkFromStart } from '../directions';
import { layerLabel } from '../labels';
import { facilitiesFor, getFacility, getVenue } from '../mock';
import { sponsoredStandsFor } from '../sponsors';
import { layerById, layerOf, layerView, mapLayers, SINGLE_LAYER, toLayerPoint, venueMapFor } from '../venue-maps';

// mock.ts reaches reports.ts through labels, and reports.ts builds its store on AsyncStorage.
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: async () => null, setItem: async () => {} } }));

const map = venueMapFor(getVenue('sofi')!);
const facilities = facilitiesFor('sofi');
const sofi = (id: string) => getFacility('sofi', id) ?? (() => { throw new Error(id); })();
const nowhere = { venueId: 'sofi', facilityId: null };
const LANGS = Object.keys(resources) as (keyof typeof resources)[];
type Row = { name?: string; description?: string; location?: string };
const text = (lng: keyof typeof resources, id: string) => (resources[lng].venue.facilityText as Record<string, Row>)[id];

// Checked against SoFi's A-Z guide, accessibility, policy and parking pages, and pinned on the
// parking zones map and the Level 3 / Level 6 concourse maps (see the SOFI comment in mock.ts).
describe('SoFi Stadium facilities', () => {
  it('lists all twelve entries on the outside map', () => {
    const gates = facilities.filter(f => f.category === 'gate');
    expect(gates.map(f => f.id)).toEqual(Array.from({ length: 12 }, (_, i) => `entry-${i + 1}`));
    expect(gates.every(f => layerOf(map, f) === 'outside')).toBe(true);
    for (const vip of ['entry-6', 'entry-7', 'entry-11', 'entry-12']) expect(sofi(vip).tags.map(t => t.id)).toContain('premium_access');
  });

  it('puts the pins on the markers the official maps draw for them', () => {
    const at = (id: string) => [sofi(id).layer ?? 'outside', sofi(id).x, sofi(id).y];
    expect(at('entry-1')).toEqual(['outside', 0.414, 0.313]); // the "1" circle on Touchdown Dr.
    expect(at('entry-9')).toEqual(['outside', 0.449, 0.502]); // 9A, first of 9A to 9D
    expect(at('accessible-drop-off')).toEqual(['outside', 0.257, 0.375]); // District Dr., Champions Way to Touchdown Dr.
    expect(at('first-aid-ne')).toEqual(['level-3', 0.74, 0.28]); // the red + on Level 3
    expect(at('sensory-room-sw')).toEqual(['level-3', 0.252, 0.613]); // "SR" by the Corona Beach House
    expect(at('first-aid-sw-6')).toEqual(['level-6', 0.245, 0.651]); // the red + by section 330
    expect(at('pedestrian-ramp')).toEqual(['level-3', 0.791, 0.72]); // the ramp icon, south-east
  });

  it('pins each accessibility podium just inside its entry, towards the bowl', () => {
    for (const n of [4, 8, 10]) {
      const podium = sofi(`podium-entry-${n}`);
      const entry = sofi(`entry-${n}`);
      expect(podium.category).toBe('accessible');
      expect(podium.tags.map(t => t.id)).toContain('wheelchair_escort');
      expect(Math.hypot(podium.x - entry.x, podium.y - entry.y)).toBeLessThan(0.03);
      expect(sofi(`entry-${n}`).description).toMatch(/podium/);
    }
  });

  it('marks the spots SoFi doesn’t publish as approximate, and only those', () => {
    expect(facilities.filter(f => f.approximate).map(f => f.id).sort()).toEqual(['first-aid-nw', 'first-aid-se', 'lactation-suite', 'service-animal-relief']);
    // No route and "ask staff" for them.
    expect(routeFor(map, facilities, nowhere, 'sofi', 'lactation-suite')).toBeNull();
    expect(walkFromStart(map, facilities, nowhere, 'sofi', sofi('service-animal-relief'))).toEqual({ kind: 'ask' });
  });

  it('lists what each desk offers', () => {
    const tags = (id: string) => sofi(id).tags.map(t => t.id);
    for (const desk of ['guest-services-ne', 'guest-services-sw']) expect(tags(desk)).toEqual(expect.arrayContaining(['sensory_room', 'sensory_kits', 'lost_items']));
    for (const desk of facilities.filter(f => f.category === 'info')) expect(tags(desk.id)).toContain('lost_items');
    for (const room of ['sensory-room-ne', 'sensory-room-sw']) expect(tags(room)).toContain('sensory_room');
    for (const restroom of ['restrooms-n', 'restrooms-sw', 'restrooms-nw', 'restrooms-se', 'adult-changing']) expect(tags(restroom)).toContain('changing_table');
    for (const zone of ['brown-zone', 'green-zone', 'blue-zone', 'purple-zone', 'orange-zone']) expect(tags(zone)).toContain('permit_needed');
  });

  it('carries every published fact into all 13 languages', () => {
    const facts: [string, keyof Row, RegExp][] = [
      ['entry-4', 'description', /(12|۱۲)×(6|۶)×(12|۱۲)/], // clear bag size
      ['rideshare-kareem', 'description', /K/], // Metro C or K Line
      ['rideshare-kareem', 'description', /(8|۸)/], // Bus Bay 8
      ['sensory-room-ne', 'description', /(15|۱۵)/], // 15-minute turns
      ['hydration-sw', 'description', /(20|۲۰)/], // 20 oz bottle
      ['adult-changing', 'location', /(329|۳۲۹)/],
      ['purple-zone', 'location', /(3801|۳۸۰۱)/],
      ['green-zone', 'location', /(800|۸۰۰)/],
      ['elevator-north', 'location', /(207|۲۰۷)/],
    ];
    for (const lng of LANGS) {
      for (const [id, field, fact] of facts) {
        expect({ lng, id, field, ok: fact.test(text(lng, id)?.[field] ?? '') }).toEqual({ lng, id, field, ok: true });
      }
    }
  });

  it('translates every description (no English left in other languages)', () => {
    for (const lng of LANGS.filter(l => l !== 'en')) {
      for (const f of facilities) {
        expect({ lng, id: f.id, same: text(lng, f.id).description === text('en', f.id).description }).toEqual({ lng, id: f.id, same: false });
      }
    }
  });

  it('keeps its event-day text line', () => {
    expect(venueContact('sofi')?.text).toBe('+14245419222');
  });
});

describe('SoFi map layers', () => {
  const layers = mapLayers(map);

  it('has the outside map, then Level 3 and Level 6, all hotlinked from sofistadium.com', () => {
    expect(layers.map(l => l.id)).toEqual(['outside', 'level-3', 'level-6']);
    expect(layers.map(l => layerLabel(l, i18n.getFixedT('en', 'venue')))).toEqual(['Outside', 'Level 3', 'Level 6']);
    for (const l of layers) expect(l.image.url).toMatch(/^https:\/\/www\.sofistadium\.com\/assets\/img\/.+\.jpg$/);
    // The first layer is the map's own image, focus and width.
    expect([layers[0].image, layers[0].focus, layers[0].widthMeters, layers[0].toBase]).toEqual([map.image, map.focus, map.widthMeters, undefined]);
  });

  it('frames the stadium and all twelve entries in the outside focus', () => {
    const [l, t, r, b] = layers[0].focus;
    for (const f of facilities.filter(g => g.category === 'gate')) {
      expect({ id: f.id, inside: f.x > l && f.x < r && f.y > t && f.y < b }).toEqual({ id: f.id, inside: true });
    }
  });

  it('lays the level maps over the outside map where the stadium is', () => {
    const level3 = layerById(map, 'level-3');
    // Level 3's VIP Entry 12 and VIP Entry 7 elevators land by Entries 12 and 7 on the parking map.
    const near = (p: { x: number; y: number }, id: string) => expect(Math.hypot(p.x - sofi(id).x, (p.y - sofi(id).y) * 3300 / 2550)).toBeLessThan(0.025);
    near(toLayerPoint(map, { x: 0.785, y: 0.2923 }, 'level-3', 'outside'), 'entry-12');
    near(toLayerPoint(map, { x: 0.1912, y: 0.5965 }, 'level-3', 'outside'), 'entry-7');
    // Metres agree: a layer's width is the outside width times the placement's scale.
    const [a, , , d] = level3.toBase!;
    const scale = Math.hypot(a, d * 3300 / 2550);
    expect(level3.widthMeters).toBeCloseTo(layers[0].widthMeters * scale, -1);
    expect(layerById(map, 'level-6').toBase).toEqual(level3.toBase); // one frame for both level maps
  });

  it('converts points both ways between layers', () => {
    const p = { x: 0.4, y: 0.6 };
    const there = toLayerPoint(map, p, 'level-6', 'outside');
    const back = toLayerPoint(map, there, 'outside', 'level-6');
    expect(back.x).toBeCloseTo(p.x, 9);
    expect(back.y).toBeCloseTo(p.y, 9);
    const level6 = toLayerPoint(map, p, 'level-3', 'level-6'); // the same frame: the same point
    expect(level6.x).toBeCloseTo(p.x, 9);
    expect(level6.y).toBeCloseTo(p.y, 9);
  });

  it('puts a facility without a layer, or with an unknown one, on the outside map', () => {
    expect(layerOf(map, {})).toBe('outside');
    expect(layerOf(map, { layer: 'level-99' })).toBe('outside');
    // The sponsored stands name no layer, so they stay where they were drawn: outside.
    expect(sponsoredStandsFor('sofi').map(s => layerOf(map, s))).toEqual(['outside', 'outside']);
  });

  it('shows one layer at a time with its own image, focus and width', () => {
    const view = layerView(map, 'level-3');
    expect(view.image).toBe(layerById(map, 'level-3').image);
    expect(view.focus).toEqual(layerById(map, 'level-3').focus);
    expect(view.widthMeters).toBe(659);
    expect(layerView(map, 'level-3')).toBe(view); // stable, for the map view's fit
    expect(layerView(map, 'outside').image).toBe(map.image);
  });

  it('leaves a venue without layers as it was: one layer, no toggle', () => {
    const intuit = venueMapFor(getVenue('intuit-dome')!);
    expect(mapLayers(intuit).map(l => l.id)).toEqual([SINGLE_LAYER]);
    expect(layerView(intuit, 'level-3')).toBe(intuit);
    expect(facilitiesFor('intuit-dome').every(f => layerOf(intuit, f) === SINGLE_LAYER)).toBe(true);
    const crypto = venueMapFor(getVenue('crypto-arena')!);
    expect(mapLayers(crypto)[0].image.url).toBe('local:crypto-arena-map'); // Krisha's bundled blueprint
  });
});

describe('walks across SoFi’s layers', () => {
  it('walks to an entry, changes level, then walks on the facility’s layer', () => {
    // From Entry 4 (outside, the way in) to First Aid NE (Level 3).
    const route = routeFor(map, facilities, nowhere, 'sofi', 'first-aid-ne')!;
    expect(route.layer).toBe('level-3');
    expect(route.levelChange?.id).toBe('level-3');
    expect(route.start).toEqual(toLayerPoint(map, sofi('entry-4'), 'outside', 'level-3'));
    // Entry 4 falls on the north-west of the Level 3 ring, so the walk heads east across the north.
    expect(route.start.x).toBeLessThan(0.45);
    expect(route.start.y).toBeLessThan(0.3);
    expect(route.walk.heading).toMatch(/^(e|se|ne)$/);
    expect(route.walk.minutes).toBeGreaterThan(LEVEL_CHANGE_MINUTES);
    expect(route.walk.minutes).toBeLessThanOrEqual(12);
    // The list says the same minutes as the route panel.
    expect(walkFromStart(map, facilities, nowhere, 'sofi', sofi('first-aid-ne'))).toEqual({ kind: 'walk', minutes: route.walk.minutes });
    // The map marks the start where Entry 4 falls on Level 3.
    expect(startMarker(route)).toEqual({ kind: 'start', at: sofi('entry-4'), point: route.start });
  });

  it('adds the level change to the straight walk, and nothing within one layer', () => {
    const cross = routeFor(map, facilities, nowhere, 'sofi', 'guest-services-n')!;
    const straight = Math.max(1, Math.round(cross.walk.meters / 75));
    expect(cross.walk.minutes).toBe(straight + LEVEL_CHANGE_MINUTES);
    const same = routeFor(map, facilities, nowhere, 'sofi', 'entry-10')!;
    expect(same.levelChange).toBeNull();
    expect(same.walk.minutes).toBe(Math.max(1, Math.round(same.walk.meters / 75)));
  });

  it('walks within a level without changing level', () => {
    const route = routeFor(map, facilities, { venueId: 'sofi', facilityId: 'guest-services-sw' }, 'sofi', 'restrooms-sw')!;
    expect([route.layer, route.levelChange, route.fromIsMine]).toEqual(['level-3', null, true]);
    expect(route.start).toEqual({ x: sofi('guest-services-sw').x, y: sofi('guest-services-sw').y });
  });

  it('goes back outside from inside', () => {
    const route = routeFor(map, facilities, { venueId: 'sofi', facilityId: 'guest-services-sw' }, 'sofi', 'blue-zone')!;
    expect(route.layer).toBe('outside');
    expect(route.levelChange?.kind).toBe('outside');
  });

  it('words the level change in every language', () => {
    for (const lng of LANGS) {
      const t = i18n.getFixedT(lng, 'venue');
      const level = layerLabel(layerById(map, 'level-6'), t);
      expect({ lng, ok: t('directions.stepLevel', { level }).includes(level) && /(6|۶)/.test(level) }).toEqual({ lng, ok: true });
      expect({ lng, ok: !!t('directions.stepOut') && !!t('map.layers.label') }).toEqual({ lng, ok: true });
    }
  });
});
