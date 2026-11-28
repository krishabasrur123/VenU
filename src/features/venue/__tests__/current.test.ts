import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_WHERE,
  getWhereAmI,
  hydrateWhereAmI,
  isMeetSpot,
  resetWhereAmIForTests,
  setCurrentSpot,
  setCurrentVenue,
  setWhereAmIOwner,
  validWhere,
  WHERE_KEY,
} from '../current';
import { getFacility } from '../mock';
import { featuredStandFor } from '../sponsors';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const KEY = `${WHERE_KEY}.u1`;
const saved = async (key = KEY) => JSON.parse((await AsyncStorage.getItem(key)) ?? 'null');
const save = (value: unknown, key = KEY) => AsyncStorage.setItem(key, JSON.stringify(value));

describe('where am I', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    resetWhereAmIForTests();
    setWhereAmIOwner('u1');
  });

  it('starts at SoFi with no spot', async () => {
    await hydrateWhereAmI();
    expect(getWhereAmI()).toEqual(DEFAULT_WHERE);
  });

  it("saves the venue and spot under the account's key", async () => {
    await setCurrentVenue('crypto-arena');
    await setCurrentSpot('star-plaza-entrance');
    expect(getWhereAmI()).toEqual({ venueId: 'crypto-arena', facilityId: 'star-plaza-entrance' });
    expect(await saved()).toEqual({ venueId: 'crypto-arena', facilityId: 'star-plaza-entrance' });
  });

  it('opening another venue forgets the spot; reopening the same one keeps it', async () => {
    await setCurrentSpot('entry-4');
    await setCurrentVenue('sofi');
    expect(getWhereAmI().facilityId).toBe('entry-4');
    await setCurrentVenue('intuit-dome');
    expect(getWhereAmI()).toEqual({ venueId: 'intuit-dome', facilityId: null });
  });

  it('ignores unknown venues and facilities', async () => {
    await setCurrentVenue('nowhere');
    await setCurrentSpot('not-a-facility');
    expect(getWhereAmI()).toEqual(DEFAULT_WHERE);
  });

  it('reads back a saved value, dropping stale ids', async () => {
    await save({ venueId: 'intuit-dome', facilityId: 'main-entrance' });
    await hydrateWhereAmI();
    expect(getWhereAmI()).toEqual({ venueId: 'intuit-dome', facilityId: 'main-entrance' });
    expect(validWhere({ venueId: 'sofi', facilityId: 'gone' })).toEqual({ venueId: 'sofi', facilityId: null });
    expect(validWhere({ venueId: 'gone' })).toEqual(DEFAULT_WHERE);
    expect(validWhere('{bad')).toEqual(DEFAULT_WHERE);
  });

  it('never makes an unpublished spot (Elevators, Sensory Room) the visitor\'s spot', async () => {
    await setCurrentVenue('intuit-dome');
    await setCurrentSpot('main-entrance');
    await setCurrentSpot('elevators');
    expect(getWhereAmI()).toEqual({ venueId: 'intuit-dome', facilityId: 'main-entrance' });
    expect(isMeetSpot(getFacility('intuit-dome', 'sensory-room')!)).toBe(false);
    expect(isMeetSpot(getFacility('intuit-dome', 'main-entrance')!)).toBe(true);
    expect(isMeetSpot(featuredStandFor('intuit-dome')!)).toBe(false);
  });

  it('drops a spot saved before it became unpublished, keeping the venue', async () => {
    await save({ venueId: 'intuit-dome', facilityId: 'sensory-room' });
    await hydrateWhereAmI();
    expect(getWhereAmI()).toEqual({ venueId: 'intuit-dome', facilityId: null });
  });

  it('reopening the saved venue on launch keeps the saved spot', async () => {
    await save({ venueId: 'sofi', facilityId: 'entry-4' });
    await setCurrentVenue('sofi'); // the venue screen mounts before the read finishes
    expect(getWhereAmI()).toEqual({ venueId: 'sofi', facilityId: 'entry-4' });
    expect(await saved()).toEqual({ venueId: 'sofi', facilityId: 'entry-4' });
  });

  it('opening another venue on launch replaces the saved one, even the default', async () => {
    await save({ venueId: 'intuit-dome', facilityId: 'main-entrance' });
    await setCurrentVenue('sofi');
    expect(getWhereAmI()).toEqual({ venueId: 'sofi', facilityId: null });
    expect(await saved()).toEqual({ venueId: 'sofi', facilityId: null });
  });

  it('keeps each account separate and starts fresh when signed out', async () => {
    await setCurrentVenue('crypto-arena');
    setWhereAmIOwner('u2');
    await hydrateWhereAmI();
    expect(getWhereAmI()).toEqual(DEFAULT_WHERE);
    setWhereAmIOwner(null);
    expect(getWhereAmI()).toEqual(DEFAULT_WHERE);
    setWhereAmIOwner('u1');
    await hydrateWhereAmI();
    expect(getWhereAmI().venueId).toBe('crypto-arena');
    expect(await AsyncStorage.getItem(`${WHERE_KEY}.u2`)).toBeNull();
  });

  it("a read for the previous account never lands on the next one's", async () => {
    await save({ venueId: 'intuit-dome', facilityId: null });
    const loading = hydrateWhereAmI();
    setWhereAmIOwner('u2');
    await loading;
    await hydrateWhereAmI();
    expect(getWhereAmI()).toEqual(DEFAULT_WHERE);
  });
});
