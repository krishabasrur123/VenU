import { describe, expect, it, jest } from '@jest/globals';

import i18n, { type UiLanguage } from '@/i18n';
import { resources } from '@/i18n/locales';

import { facilityDescription, facilityLocation, facilityName } from '../labels';
import { facilitiesFor, getFacility, getVenue, VENUES } from '../mock';
import { SEED_REPORTS } from '../reports';
import { layerById, layerOf, mapAspect, mapLayers, venueMapFor } from '../venue-maps';

// reports.ts builds its store on AsyncStorage, which has no native module under jest.
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: async () => null, setItem: async () => {} } }));

// Every venue's facilities come from its official guide (see mock.ts).
const RESEARCHED = ['sofi', 'crypto-arena', 'intuit-dome'];
// Pins are normalized (0 to 1) on the venue's map: keep each inside its edge, and apart from the
// others by this share of the map's width (pins overlap a little only until the visitor zooms in).
const EDGE = 0.01;
const MIN_GAP = 0.018;
const LANGS = Object.keys(resources) as UiLanguage[];
const getVenueOrThrow = (id: string) => getVenue(id) ?? (() => { throw new Error(id); })();

describe('venue facility data', () => {
  it.each(VENUES.map(v => v.id))('%s has gates, first aid and guest services, with unique ids', venueId => {
    const list = facilitiesFor(venueId);
    const ids = list.map(f => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const category of ['gate', 'first_aid', 'info'] as const) {
      expect({ venueId, category, found: list.some(f => f.category === category) }).toEqual({ venueId, category, found: true });
    }
    expect(list.every(f => f.venueId === venueId)).toBe(true);
  });

  it.each(VENUES.map(v => v.id))('%s puts every pin inside its layer’s map, clear of the others there', venueId => {
    const list = facilitiesFor(venueId);
    const map = venueMapFor(getVenueOrThrow(venueId));
    for (const f of list) {
      expect({ id: f.id, inside: f.x >= EDGE && f.x <= 1 - EDGE && f.y >= EDGE && f.y <= 1 - EDGE }).toEqual({ id: f.id, inside: true });
      // A pin names a layer the map has (a typo would quietly drop it on the first layer).
      expect({ id: f.id, layer: f.layer === undefined || mapLayers(map).some(l => l.id === f.layer) }).toEqual({ id: f.id, layer: true });
    }
    for (const a of list) {
      for (const b of list) {
        if (a.id >= b.id || layerOf(map, a) !== layerOf(map, b)) continue;
        const aspect = mapAspect(layerById(map, layerOf(map, a)));
        // In widths of the map: a step down a tall map is longer than the same share across.
        const gap = Math.hypot(a.x - b.x, (a.y - b.y) / aspect);
        expect({ pair: `${a.id}/${b.id}`, apart: gap >= MIN_GAP }).toEqual({ pair: `${a.id}/${b.id}`, apart: true });
      }
    }
  });

  it.each(VENUES.map(v => v.id))('%s starts walks from one of its own facilities', venueId => {
    const map = venueMapFor(getVenueOrThrow(venueId));
    expect(getFacility(venueId, map.arrival ?? undefined)?.category).toBe('gate');
  });

  it('has a name, description and location for every facility in all 13 languages', () => {
    const all = VENUES.flatMap(v => facilitiesFor(v.id));
    for (const lng of LANGS) {
      const text = resources[lng].venue.facilityText as Record<string, { name?: string; description?: string; location?: string }>;
      for (const f of all) {
        const row = text[f.id];
        const ok = !!row?.description && !!row.location && !!row.name;
        expect({ lng, id: f.id, ok }).toEqual({ lng, id: f.id, ok: true });
      }
    }
  });

  it('keeps mock.ts and the English strings in step (an id clash would show another facility’s text)', () => {
    const en = i18n.getFixedT('en', 'venue');
    for (const venueId of RESEARCHED) {
      for (const f of facilitiesFor(venueId)) {
        expect([facilityName(f, en), facilityDescription(f, en), facilityLocation(f, en)]).toEqual([f.name, f.description, f.location]);
      }
    }
  });

  it('translates every researched facility name (proper nouns stay inside the translation)', () => {
    for (const lng of LANGS.filter(l => l !== 'en')) {
      const t = i18n.getFixedT(lng, 'venue');
      for (const venueId of RESEARCHED) {
        for (const f of facilitiesFor(venueId)) {
          expect({ lng, id: f.id, same: facilityName(f, t) === f.name }).toEqual({ lng, id: f.id, same: false });
        }
      }
    }
    expect(facilityName(getFacility('crypto-arena', 'kobe-bryant-entrance')!, i18n.getFixedT('es', 'venue'))).toBe('Entrada Kobe Bryant');
    expect(facilityName(getFacility('sofi', 'entry-4')!, i18n.getFixedT('fa', 'venue'))).toBe('ورودی ۴');
  });

  it('points every seed report at a facility of its own venue', () => {
    for (const r of SEED_REPORTS) {
      expect({ id: r.id, found: !!getFacility(r.venueId, r.facilityId) }).toEqual({ id: r.id, found: true });
    }
    for (const venueId of RESEARCHED) {
      expect(SEED_REPORTS.some(r => r.venueId === venueId)).toBe(true);
    }
  });
});
