import { afterEach, describe, expect, it } from '@jest/globals';

import i18n from '@/i18n';

import { emptyFacilitiesMessage } from '../categories';
import { eventsLabel, facilityDescription, facilityLocation, facilityMeta, facilityName, tagLabel } from '../labels';
import { facilitiesFor, getFacility, getVenue, searchFacilities, searchKey, searchVenues } from '../mock';
import type { Facility } from '../types';

const sofi = getVenue('sofi')!;
const entry4 = getFacility('sofi', 'entry-4')!;
const sofiFacilities = facilitiesFor('sofi');

afterEach(async () => { await i18n.changeLanguage('en'); });

describe('venue labels', () => {
  it('reads like the old English strings', () => {
    expect(eventsLabel(sofi)).toBe('Opening Ceremony, Swimming');
    expect(facilityMeta(entry4)).toBe('4 min walk · Short wait');
    expect(facilityLocation(entry4)).toBe('North side');
    expect(facilityDescription(entry4)).toBe(entry4.description);
    expect(tagLabel(entry4.tags[0])).toBe('Accessible');
  });

  it('translates every label except names', async () => {
    await i18n.changeLanguage('es');
    expect(eventsLabel(sofi)).toBe('Ceremonia de apertura y Natación');
    expect(facilityMeta(entry4)).toBe('4 min a pie · Poca espera');
    expect(facilityLocation(entry4)).toBe('Lado norte');
    expect(tagLabel(entry4.tags[0])).toBe('Accesible');
    expect(emptyFacilitiesMessage('restroom', 'xyz', 'SoFi Stadium')).toBe('Ningún baño coincide con «xyz»');
    expect(emptyFacilitiesMessage(null, '', 'Intuit Dome')).toBe('Aún no hay servicios en Intuit Dome');
  });

  it('uses each language\'s plural forms for the walk time', async () => {
    await i18n.changeLanguage('ar');
    expect(facilityMeta({ ...entry4, walkMinutes: 1 })).toBe('دقيقة واحدة سيرًا · انتظار قصير');
    expect(facilityMeta({ ...entry4, walkMinutes: 3 })).toBe('3 دقائق سيرًا · انتظار قصير');
  });

  it('writes numbers in the language\'s digits, still choosing the plural by count', () => {
    const fa = i18n.getFixedT('fa', 'venue');
    expect(facilityMeta(entry4, fa)).toMatch(/^۴ /); // not "4 دقیقه" next to Persian digits elsewhere
    expect(fa('facility.reportCount', { count: 12, number: '۱۲' })).toContain('۱۲');
    expect(facilityMeta({ ...entry4, walkMinutes: 1 }, i18n.getFixedT('ru', 'venue'))).toMatch(/^1 /);
  });

  it('calls Intuit Dome\'s event basketball in every language (LA28 plays basketball there)', () => {
    const dome = getVenue('intuit-dome')!;
    const label = (lng: string) => eventsLabel(dome, i18n.getFixedT(lng, 'venue'), lng);
    expect(['en', 'es', 'ja', 'ko', 'zh', 'ar', 'pt'].map(label)).toEqual(['Basketball', 'Baloncesto', 'バスケットボール', '농구', '篮球', 'كرة السلة', 'Basquete']);
    expect(searchVenues('basketball').map(v => v.id)).toEqual(['intuit-dome']);
  });

  it('translates facility names', () => {
    const t = (lng: string) => i18n.getFixedT(lng, 'venue');
    expect(facilityName(entry4, t('en'))).toBe('Entry 4');
    expect(facilityName(entry4, t('es'))).toBe('Entrada 4');
    expect(facilityName(entry4, t('fa'))).toBe('ورودی ۴');
    expect(facilityName(getFacility('sofi', 'first-aid-nw')!, t('es'))).toBe('Primeros auxilios NO');
    expect(facilityName({ ...entry4, id: 'entry-99', name: 'Entry 99' }, t('es'))).toBe('Entry 99');
  });

  it('finds a facility by its translated name', () => {
    const es = i18n.getFixedT('es', 'venue');
    expect(searchFacilities(sofiFacilities, 'rampa peatonal', null, es).map(f => f.id)).toEqual(['pedestrian-ramp']);
    expect(searchFacilities(sofiFacilities, 'entrada', 'gate', es).map(f => f.id)).toEqual(['entry-3', 'entry-4', 'entry-6', 'entry-8', 'entry-10', 'entry-11']);
  });

  it('keeps a facility\'s own text when there is no translation for it', async () => {
    await i18n.changeLanguage('es');
    const other: Facility = { ...entry4, id: 'entry-99', description: 'From the backend', location: 'Somewhere' };
    expect(facilityDescription(other)).toBe('From the backend');
    expect(facilityLocation(other)).toBe('Somewhere');
  });
});

describe('search in the app language', () => {
  it('finds venues and facilities by translated words, and still by English', async () => {
    await i18n.changeLanguage('es');
    expect(searchVenues('natación').map(v => v.id)).toEqual(['sofi']);
    expect(searchVenues('swimming').map(v => v.id)).toEqual(['sofi']);
    expect(searchFacilities(sofiFacilities, 'rampa', null).map(f => f.id)).toEqual(['pedestrian-ramp']);
    expect(searchFacilities(sofiFacilities, 'ramp', 'accessible').map(f => f.id)).toEqual(['pedestrian-ramp']);
  });

  it('ignores accents, digit scripts, Arabic vs Persian letters and curly apostrophes', () => {
    const ids = (q: string, lang: string) => searchFacilities(sofiFacilities, q, null, i18n.getFixedT(lang, 'venue')).map(f => f.id);
    expect(ids('entree 4', 'fr')).toEqual(['entry-4']);
    expect(searchVenues('natacion', undefined, i18n.getFixedT('es', 'venue')).map(v => v.id)).toEqual(['sofi']);
    expect(ids('ورودی 4', 'fa')).toEqual(['entry-4']); // shown as ورودی ۴
    expect(ids('المدخل ٤', 'ar')).toEqual(['entry-4']); // shown as المدخل 4
    expect(ids('ورودي ۴', 'fa')).toEqual(['entry-4']); // typed with the Arabic ي
    expect(ids("stadium's", 'en')).toEqual(['pedestrian-ramp']); // written stadium’s
  });

  it('folds search text the same way on both sides', () => {
    expect(searchKey('Objets Trouvés')).toBe('objets trouves');
    expect(searchKey('دروازه ۲')).toBe('دروازه 2');
    expect(searchKey('Men’s')).toBe("men's");
    expect(searchKey('出口 4')).toBe('出口 4');
  });
});
