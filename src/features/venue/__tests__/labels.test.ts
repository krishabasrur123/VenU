import { afterEach, describe, expect, it } from '@jest/globals';

import i18n from '@/i18n';

import { emptyFacilitiesMessage } from '../categories';
import { eventsLabel, facilityDescription, facilityLocation, facilityMeta, tagLabel } from '../labels';
import { facilitiesFor, getVenue, searchFacilities, searchVenues } from '../mock';
import type { Facility } from '../types';

const sofi = getVenue('sofi')!;
const gate2 = facilitiesFor('sofi').find(f => f.id === 'gate-2')!;

afterEach(async () => { await i18n.changeLanguage('en'); });

describe('venue labels', () => {
  it('reads like the old English strings', () => {
    expect(eventsLabel(sofi)).toBe('Opening Ceremony, Swimming');
    expect(facilityMeta(gate2)).toBe('3 min walk · Short wait');
    expect(facilityLocation(gate2)).toBe('East side, by Lot C');
    expect(facilityDescription(gate2)).toBe(gate2.description);
    expect(tagLabel(gate2.tags[0])).toBe('Accessible');
  });

  it('translates every label except names', async () => {
    await i18n.changeLanguage('es');
    expect(eventsLabel(sofi)).toBe('Ceremonia de apertura y Natación');
    expect(facilityMeta(gate2)).toBe('3 min a pie · Poca espera');
    expect(facilityLocation(gate2)).toBe('Lado este, junto al Lote C');
    expect(tagLabel(gate2.tags[0])).toBe('Accesible');
    expect(emptyFacilitiesMessage('restroom', 'xyz', 'SoFi Stadium')).toBe('Ningún baño coincide con «xyz»');
    expect(emptyFacilitiesMessage(null, '', 'Intuit Dome')).toBe('Aún no hay servicios en Intuit Dome');
  });

  it('uses each language\'s plural forms for the walk time', async () => {
    await i18n.changeLanguage('ar');
    expect(facilityMeta({ ...gate2, walkMinutes: 1 })).toBe('دقيقة واحدة سيرًا · انتظار قصير');
    expect(facilityMeta({ ...gate2, walkMinutes: 3 })).toBe('3 دقائق سيرًا · انتظار قصير');
  });

  it('keeps a facility\'s own text when there is no translation for it', async () => {
    await i18n.changeLanguage('es');
    const other: Facility = { ...gate2, id: 'gate-99', description: 'From the backend', location: 'Somewhere' };
    expect(facilityDescription(other)).toBe('From the backend');
    expect(facilityLocation(other)).toBe('Somewhere');
  });
});

describe('search in the app language', () => {
  it('finds venues and facilities by translated words, and still by English', async () => {
    await i18n.changeLanguage('es');
    expect(searchVenues('natación').map(v => v.id)).toEqual(['sofi']);
    expect(searchVenues('swimming').map(v => v.id)).toEqual(['sofi']);
    const all = facilitiesFor('sofi');
    expect(searchFacilities(all, 'rampa', null).map(f => f.id)).toEqual(['gate-2']);
    expect(searchFacilities(all, 'ramp', 'gate').map(f => f.id)).toEqual(['gate-2']);
  });
});
