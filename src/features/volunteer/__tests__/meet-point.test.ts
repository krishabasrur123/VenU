import { describe, expect, it, jest } from '@jest/globals';

import { facilitiesFor } from '@/features/venue/mock';
import { localStub } from '@/features/translate/local';
import i18n from '@/i18n';

import { meetPlaceLine, meetPointFrom, meetSpotLabel, meetSpotsFor, restoreMeetPoint, spotChoices } from '../meet-point';
import { greetingFrom, MOCK_VOLUNTEERS, mockIncoming } from '../mock';

// current.ts (the venue store) keeps the spot in AsyncStorage, which has no native module under jest.
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const t = (lng: string) => i18n.getFixedT(lng, 'volunteer');
const tv = (lng: string) => i18n.getFixedT(lng, 'venue');

describe('meet point', () => {
  it('copies the current venue and spot', () => {
    expect(meetPointFrom({ venueId: 'sofi', facilityId: 'entry-4' })).toEqual({ venueId: 'sofi', facilityId: 'entry-4' });
  });

  it('is worded in the language on screen, so a language switch follows', () => {
    const point = { venueId: 'sofi', facilityId: 'entry-4' };
    expect(meetPlaceLine(point, tv('en'), t('en'))).toBe('Near Entry 4 · SoFi Stadium');
    expect(meetPlaceLine(point, tv('es'), t('es'))).toBe('Cerca de Entrada 4 · SoFi Stadium');
    expect(meetSpotLabel(point, tv('ar'), t('ar'))).toBe('قرب المدخل 4');
    expect(meetSpotLabel({ venueId: 'crypto-arena', facilityId: 'kobe-bryant-entrance' }, tv('ja'), t('ja'))).toBe('Kobe Bryant 入口付近');
  });

  it('shows just the venue when the visitor isn’t sure where they are', () => {
    const point = { venueId: 'intuit-dome', facilityId: null };
    expect(meetSpotLabel(point, tv('en'), t('en'))).toBeNull();
    expect(meetPlaceLine(point, tv('fr'), t('fr'))).toBe('Intuit Dome');
  });

  it('restores only real ids, and keeps the venue of an old text-shaped point', () => {
    expect(restoreMeetPoint({ venueId: 'crypto-arena', facilityId: 'sensory-pod' })).toEqual({ venueId: 'crypto-arena', facilityId: 'sensory-pod' });
    expect(restoreMeetPoint({ venueId: 'crypto-arena', facilityId: 'entry-4' })).toEqual({ venueId: 'crypto-arena', facilityId: null });
    expect(restoreMeetPoint({ spot: 'Near Gate 2 Ramp', venue: 'Intuit Dome' })).toEqual({ venueId: 'intuit-dome', facilityId: null });
    expect(restoreMeetPoint({ spot: 'x', venue: 42 })).toEqual({ venueId: 'sofi', facilityId: null });
    expect(restoreMeetPoint('Near Gate 2 Ramp')).toEqual({ venueId: 'sofi', facilityId: null });
  });
});

describe('spot choices', () => {
  const sofi = facilitiesFor('sofi');

  it('lists every facility, gates first, keeping the venue’s order within a type', () => {
    const ids = spotChoices(sofi, '', null).map(f => f.id);
    expect(ids).toHaveLength(sofi.length);
    expect(ids.slice(0, 6)).toEqual(['entry-3', 'entry-4', 'entry-6', 'entry-8', 'entry-10', 'entry-11']);
    expect(ids.indexOf('lactation-suite')).toBeLessThan(ids.indexOf('first-aid-se')); // restrooms before first aid, as the chips
  });

  it('searches in the app language and in English, within the chip', () => {
    expect(spotChoices(sofi, 'rampa', null, tv('es')).map(f => f.id)).toEqual(['pedestrian-ramp']);
    expect(spotChoices(sofi, 'sensory', 'info', tv('es')).map(f => f.id)).toEqual(['guest-services-ne', 'guest-services-sw']);
    expect(spotChoices(sofi, 'entrada 1', 'gate', tv('es')).map(f => f.id)).toEqual(['entry-10', 'entry-11']);
    expect(spotChoices(sofi, 'zzz', null, tv('en'))).toEqual([]);
  });

  it('leaves out spots the venue doesn’t publish (no one could find you there)', () => {
    const intuit = meetSpotsFor('intuit-dome');
    expect(intuit.map(f => f.id)).toEqual(facilitiesFor('intuit-dome').filter(f => !f.approximate).map(f => f.id));
    expect(intuit.some(f => f.id === 'elevators' || f.id === 'sensory-room')).toBe(false);
    expect(spotChoices(intuit, 'elevator', null, tv('en'))).toEqual([]);
    expect(meetSpotsFor('sofi')).toEqual(sofi);
  });
});

describe('the mock volunteer names a real spot', () => {
  it('greets with the facility in the volunteer’s language, and the reader sees it in theirs', () => {
    const daniel = MOCK_VOLUNTEERS[0]!;
    const greeting = greetingFrom(daniel, 'Rosa', { venueId: 'crypto-arena', facilityId: 'figueroa-entrance' });
    expect(greeting).toBe("Hi Rosa! I'm Daniel, your LA28 volunteer. I'm heading to you now. Meeting point: Figueroa Entrance.");
    expect(localStub.translateOne(greeting, 'es').text).toContain('Punto de encuentro: Entrada Figueroa.');
    expect(greetingFrom(daniel, '', { venueId: 'intuit-dome', facilityId: null })).toContain('Meeting point: Intuit Dome.');
  });

  it('places the example incoming requests at real SoFi facilities', () => {
    for (const r of mockIncoming()) {
      expect(restoreMeetPoint(r.location)).toEqual(r.location);
      expect(r.location.facilityId).not.toBeNull();
    }
  });
});
