import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import i18n, { type UiLanguage } from '@/i18n';
import { resources } from '@/i18n/locales';

import { categoriesAt } from '../categories';
import { nearestFirst, routeFor, walkFromStart } from '../directions';
import { facilityDescription, facilityLocation, facilityMeta, facilityName, facilityOffer, walkLabel } from '../labels';
import { facilitiesFor, getFacility, getVenue, searchFacilities, VENUES } from '../mock';
import { facilityListLayout, featuredStandFor, isSponsored, sponsoredStandsFor, takesReports, venueFacilitiesFor, waitingBannerFor } from '../sponsors';
import { mapAspect, venueMapFor } from '../venue-maps';

// Same rules as the facility pins (facilities.test.ts): inside the map, clear of every other pin.
const EDGE = 0.01;
const MIN_GAP = 0.018;
const LANGS = Object.keys(resources) as UiLanguage[];
const SPONSOR_KEYS = ['label', 'pin', 'row', 'card', 'heading', 'showScreen', 'disclosure', 'banner', 'bannerHint', 'hide'] as const;
const venueOf = (id: string) => getVenue(id) ?? (() => { throw new Error(id); })();
const allStands = () => VENUES.flatMap(v => sponsoredStandsFor(v.id));

describe('sponsored stand data', () => {
  it.each(VENUES.map(v => v.id))('%s has a sponsored stand, featured first, each a food stand with a brand and an offer', venueId => {
    const stands = sponsoredStandsFor(venueId);
    expect(stands.length).toBeGreaterThanOrEqual(1);
    expect(featuredStandFor(venueId)).toBe(stands[0]);
    for (const s of stands) {
      expect({ id: s.id, venueId: s.venueId, category: s.category, brand: !!s.sponsor.brand, offer: !!s.sponsor.offer })
        .toEqual({ id: s.id, venueId, category: 'food', brand: true, offer: true });
    }
  });

  it('features Coca-Cola at every venue (the demo placement)', () => {
    expect(VENUES.map(v => featuredStandFor(v.id)?.sponsor.brand)).toEqual(VENUES.map(() => 'Coca-Cola'));
  });

  it('gives every stand an id no other facility or stand uses (translations are keyed by id alone)', () => {
    const ids = [...VENUES.flatMap(v => facilitiesFor(v.id)), ...allStands()].map(f => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(VENUES.map(v => v.id))('%s puts each stand inside the map, clear of every other pin', venueId => {
    const aspect = mapAspect(venueMapFor(venueOf(venueId)));
    const all = venueFacilitiesFor(venueId);
    for (const s of sponsoredStandsFor(venueId)) {
      expect({ id: s.id, inside: s.x >= EDGE && s.x <= 1 - EDGE && s.y >= EDGE && s.y <= 1 - EDGE }).toEqual({ id: s.id, inside: true });
      for (const f of all) {
        if (f.id === s.id) continue;
        const gap = Math.hypot(s.x - f.x, (s.y - f.y) / aspect);
        expect({ pair: `${s.id}/${f.id}`, apart: gap >= MIN_GAP }).toEqual({ pair: `${s.id}/${f.id}`, apart: true });
      }
    }
  });

  it.each(VENUES.map(v => v.id))('%s lists each stand at the walk its route shows from the main way in', venueId => {
    const map = venueMapFor(venueOf(venueId));
    for (const s of sponsoredStandsFor(venueId)) {
      const route = routeFor(map, venueFacilitiesFor(venueId), { venueId, facilityId: null }, venueId, s.id);
      expect({ id: s.id, minutes: route?.walk.minutes }).toEqual({ id: s.id, minutes: s.walkMinutes });
    }
  });
});

describe('where sponsored stands show', () => {
  it('adds them to the venue screen only: facilitiesFor (meeting spots, emergency, requests) never has them', () => {
    for (const v of VENUES) {
      expect(facilitiesFor(v.id).some(isSponsored)).toBe(false);
      expect(venueFacilitiesFor(v.id)).toEqual([...facilitiesFor(v.id), ...sponsoredStandsFor(v.id)]);
      for (const s of sponsoredStandsFor(v.id)) expect(getFacility(v.id, s.id)).toBeUndefined();
    }
    expect(sponsoredStandsFor('nowhere')).toEqual([]);
    expect(featuredStandFor('nowhere')).toBeUndefined();
  });

  it('takes no community reports on a paid listing, only on venue facilities', () => {
    for (const v of VENUES) {
      for (const s of sponsoredStandsFor(v.id)) expect({ id: s.id, reports: takesReports(s) }).toEqual({ id: s.id, reports: false });
      for (const f of facilitiesFor(v.id)) expect({ id: f.id, reports: takesReports(f) }).toEqual({ id: f.id, reports: true });
    }
  });

  it('keeps the same arrays between calls (the venue screen memoizes on them)', () => {
    expect(venueFacilitiesFor('intuit-dome')).toBe(venueFacilitiesFor('intuit-dome'));
    expect(sponsoredStandsFor('sofi')).toBe(sponsoredStandsFor('sofi'));
  });
});

describe('translations', () => {
  it('has a name, description, location and offer for every stand in all 13 languages', () => {
    for (const lng of LANGS) {
      const text = resources[lng].venue.facilityText as Record<string, { name?: string; description?: string; location?: string; offer?: string }>;
      for (const s of allStands()) {
        const row = text[s.id];
        expect({ lng, id: s.id, ok: !!row?.name && !!row.description && !!row.location && !!row.offer }).toEqual({ lng, id: s.id, ok: true });
      }
    }
  });

  it('keeps sponsors.ts and the English strings in step', () => {
    const en = i18n.getFixedT('en', 'venue');
    for (const s of allStands()) {
      expect([facilityName(s, en), facilityDescription(s, en), facilityLocation(s, en), facilityOffer(s, en)]).toEqual([s.name, s.description, s.location, s.sponsor.offer]);
    }
  });

  it('translates every stand name and offer, keeping the brand as written', () => {
    for (const lng of LANGS.filter(l => l !== 'en')) {
      const t = i18n.getFixedT(lng, 'venue');
      for (const s of allStands()) {
        const name = facilityName(s, t);
        expect({ lng, id: s.id, translated: name !== s.name && facilityOffer(s, t) !== s.sponsor.offer, brand: name.includes(s.sponsor.brand) })
          .toEqual({ lng, id: s.id, translated: true, brand: true });
      }
    }
    expect(facilityOffer(featuredStandFor('intuit-dome')!, i18n.getFixedT('es', 'venue'))).toBe('$1 de descuento en cualquier bebida Coca-Cola con VenU');
  });

  it('has every "Sponsored" string in all 13 languages, with its placeholders', () => {
    const en = resources.en.venue.sponsor as Record<string, string>;
    const slots = (s: string) => (s.match(/\{\{\w+\}\}/g) ?? []).sort();
    for (const lng of LANGS) {
      const text = resources[lng].venue.sponsor as Record<string, string>;
      for (const key of SPONSOR_KEYS) {
        expect({ lng, key, ok: !!text[key], slots: slots(text[key] ?? '') }).toEqual({ lng, key, ok: true, slots: slots(en[key]) });
      }
      if (lng !== 'en') expect({ lng, same: text.label === en.label }).toEqual({ lng, same: false });
    }
  });

  it('starts every screen-reader label for a stand with "Sponsored"', () => {
    for (const lng of LANGS) {
      const t = i18n.getFixedT(lng, 'venue');
      const label = t('sponsor.label');
      for (const key of ['pin', 'row', 'card', 'heading', 'banner'] as const) {
        const text = t(`sponsor.${key}`, { name: 'N', meta: 'M', offer: 'O', walk: 'W' });
        expect({ lng, key, starts: text.startsWith(label) }).toEqual({ lng, key, starts: true });
      }
    }
  });
});

describe('facilityListLayout (the promoted card)', () => {
  const venueId = 'intuit-dome';
  const all = venueFacilitiesFor(venueId);
  const featured = featuredStandFor(venueId)!;
  const en = i18n.getFixedT('en', 'venue');
  const map = venueMapFor(venueOf(venueId));
  // In the list's own order (FacilityList): nearestFirst by the screen's walkTo.
  const layout = (query: string, category: Parameters<typeof searchFacilities>[2], where = { venueId, facilityId: null as string | null }) =>
    facilityListLayout(nearestFirst(searchFacilities(all, query, category, en), f => walkFromStart(map, all, where, venueId, f)).map(r => r.f), featured, query, category);

  it('orders the rows by the walk from the visitor\'s spot, as the list does', () => {
    expect(layout('', null).rows[0].id).toBe('main-entrance'); // walks start here
    const far = layout('', null, { venueId, facilityId: 'first-aid-terrace' });
    expect(far.rows[0].id).toBe('first-aid-terrace'); // you're here
    expect(far.rows.slice(-2).map(f => f.id).sort()).toEqual(['elevators', 'sensory-room']); // spots not published last
    expect(layout('stand', null, { venueId, facilityId: 'first-aid-terrace' })).toMatchObject({ promoted: featured, promotedAt: 1 });
  });

  it('puts one card first while browsing "All", and leaves the stand out of the rows', () => {
    const l = layout('', null);
    expect(l.promoted).toBe(featured);
    expect(l.promotedAt).toBe(0);
    expect(l.rows.some(f => f.id === featured.id)).toBe(false);
    expect(l.rows.length).toBe(all.length - 1);
  });

  it('shows the card for "Food & Drinks", never under another chip', () => {
    expect(layout('', 'food').promoted).toBe(featured);
    for (const category of ['gate', 'restroom', 'first_aid', 'lost_found', 'info', 'accessible', 'parking'] as const) {
      expect({ category, promoted: layout('', category).promoted }).toEqual({ category, promoted: null });
    }
  });

  it('hides the card when the search doesn’t match the stand', () => {
    const l = layout('first aid', null);
    expect(l.promoted).toBeNull();
    expect(l.rows.length).toBeGreaterThan(0);
    expect(l.rows.every(f => f.category === 'first_aid')).toBe(true);
  });

  it('puts the card after the first search result, so the best match stays on top', () => {
    // "stand" also matches Panda Express Stand (and "Standard parking").
    const l = layout('stand', null);
    expect(l.promoted).toBe(featured);
    expect(l.rows.map(f => f.id)).toContain('panda-express-intuit');
    expect(l.promotedAt).toBe(1);
    // The only match: the card is the whole list.
    expect(layout('coca-cola', null)).toMatchObject({ promoted: featured, promotedAt: 0, rows: [] });
  });

  it('shows no card at a venue without a featured stand', () => {
    const results = facilitiesFor('sofi');
    expect(facilityListLayout(results, undefined, '', null)).toEqual({ rows: results, promoted: null, promotedAt: 0 });
  });
});

describe('search and chips never answer accessibility or safety with an ad', () => {
  const all = venueFacilitiesFor('intuit-dome');
  const en = i18n.getFixedT('en', 'venue');
  const stands = (list: { id: string }[]) => list.filter(f => sponsoredStandsFor('intuit-dome').some(s => s.id === f.id)).map(f => f.id);

  it.each(['wheelchair', 'accessible', 'accessibility', 'disabled', 'disability', 'first aid', 'medical', 'lost'])('"%s" finds no sponsored stand and no promoted card', query => {
    const results = searchFacilities(all, query, null, en);
    expect(stands(results)).toEqual([]);
    expect(facilityListLayout(results, featuredStandFor('intuit-dome'), query, null).promoted).toBeNull();
  });

  it('keeps accessibility words out in the app language too', () => {
    const es = i18n.getFixedT('es', 'venue');
    expect(stands(searchFacilities(all, es('category.accessible'), null, es))).toEqual([]);
    expect(stands(searchFacilities(all, es('tags.accessible'), null, es))).toEqual([]);
  });

  it('still finds a stand by its own name, brand, offer, description and food words', () => {
    for (const query of ['coca-cola', 'refresh', 'panda', 'egg roll', 'orange chicken', 'food', 'drinks']) {
      expect({ query, found: stands(searchFacilities(all, query, null, en)).length > 0 }).toEqual({ query, found: true });
    }
    const es = i18n.getFixedT('es', 'venue');
    expect(stands(searchFacilities(all, 'descuento', null, es))).toEqual(['coca-cola-refresh-intuit']);
  });

  it('keeps stands off the Accessibility chip but keeps their wheelchair badge', () => {
    expect(stands(searchFacilities(all, '', 'accessible', en))).toEqual([]);
    expect(categoriesAt(all)).toContain('accessible'); // the venue's own accessible spots still fill it
    expect(sponsoredStandsFor('intuit-dome').every(s => s.accessible)).toBe(true);
  });
});

describe('waitingBannerFor (the waiting-screen ad slot)', () => {
  const location = { venueId: 'intuit-dome', facilityId: null };

  it('shows the venue’s featured stand to a visitor whose request is searching, with the walk to it', () => {
    const banner = waitingBannerFor({ role: 'visitor', status: 'searching', location });
    expect(banner?.stand).toBe(featuredStandFor('intuit-dome'));
    expect(banner?.walk).toEqual({ kind: 'walk', minutes: 1 });
    // From a spot the visitor set (First Aid Terrace, at the south end), the walk is longer.
    const far = waitingBannerFor({ role: 'visitor', status: 'searching', location: { venueId: 'intuit-dome', facilityId: 'first-aid-terrace' } })?.walk;
    expect(far).toEqual({ kind: 'walk', minutes: expect.any(Number) });
    expect((far as { minutes: number }).minutes).toBeGreaterThan(1);
  });

  it('words its walk with the same helper as the list, the pin card and the stand’s page', () => {
    const en = i18n.getFixedT('en', 'venue');
    const stand = featuredStandFor('intuit-dome')!;
    const walk = waitingBannerFor({ role: 'visitor', status: 'searching', location })!.walk;
    expect(walkLabel(walk, en)).toBe('1 min walk');
    expect(facilityMeta(stand, en, walk)).toBe(`${walkLabel(walk, en)} · Short wait`);
    expect(walkLabel({ kind: 'start' }, en)).toBe('Walks start here');
    expect(walkLabel({ kind: 'mine' }, en)).toBe('You’re here');
    expect(walkLabel({ kind: 'walk', minutes: 3 }, i18n.getFixedT('fa', 'venue'))).toContain('۳');
  });

  it('shows nothing anywhere else: volunteers, other request steps, no request, unknown venues', () => {
    for (const status of ['idle', 'notFound', 'matched', 'done']) {
      expect({ status, banner: waitingBannerFor({ role: 'visitor', status, location }) }).toEqual({ status, banner: null });
    }
    expect(waitingBannerFor({ role: 'volunteer', status: 'searching', location })).toBeNull();
    expect(waitingBannerFor({ role: undefined, status: 'searching', location })).toBeNull();
    expect(waitingBannerFor({ role: 'visitor', status: 'searching', location: null })).toBeNull();
    expect(waitingBannerFor({ role: 'visitor', status: 'searching', location: { venueId: 'nowhere', facilityId: null } })).toBeNull();
  });

  it('is placed on the visitor waiting screen only, and no emergency or volunteer screen touches ads', () => {
    const root = join(__dirname, '../../..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== '__tests__') walk(p); } else if (/\.tsx?$/.test(e.name)) files.push(p);
      }
    };
    walk(root);
    const rel = (p: string) => relative(root, p).replace(/\\/g, '/');
    const importing = (what: RegExp) => files.filter(p => what.test(readFileSync(p, 'utf8'))).map(rel).sort();
    expect(importing(/from '\.\/sponsor-banner'|components\/volunteer\/sponsor-banner'/)).toEqual(['components/volunteer/searching-view.tsx']);
    // Outside the Venue tab, only the banner itself reads the sponsor data or look.
    const sponsorUsers = importing(/features\/venue\/sponsor(s|-ui)'/);
    expect(sponsorUsers).toEqual(['components/volunteer/sponsor-banner.tsx']);
    for (const screen of ['components/volunteer/emergency-dialog.tsx', 'components/volunteer/emergency-card.tsx', 'components/volunteer/location-picker.tsx', 'components/volunteer/match-view.tsx', 'components/volunteer/volunteer-home.tsx']) {
      expect({ screen, mentionsSponsor: /sponsor/i.test(readFileSync(join(root, screen), 'utf8')) }).toEqual({ screen, mentionsSponsor: false });
    }
  });
});
