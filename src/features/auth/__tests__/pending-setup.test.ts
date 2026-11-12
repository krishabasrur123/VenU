import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearPendingName, forgetPendingNameUnlessFor, readPendingSetup, rememberPendingName, writePendingSetup } from '../pending-setup';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('pending setup name', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('keeps the Create Account name when the same account signs in (after confirming)', async () => {
    await writePendingSetup({ language: 'es' });
    await rememberPendingName(' Rosa@Example.com ', ' Rosa ');
    await forgetPendingNameUnlessFor('rosa@example.com');
    expect(await readPendingSetup()).toEqual({ language: 'es', firstName: 'Rosa', email: 'rosa@example.com' });
  });

  it("drops it when a different account signs in on this device, keeping the language", async () => {
    await writePendingSetup({ language: 'es' });
    await rememberPendingName('rosa@example.com', 'Rosa');
    await forgetPendingNameUnlessFor('daniel@example.com');
    expect(await readPendingSetup()).toEqual({ language: 'es', firstName: undefined, email: undefined });
  });

  it('drops a name saved before names were tied to an email', async () => {
    await AsyncStorage.setItem('venu.setup.pending', JSON.stringify({ firstName: 'Rosa' }));
    await forgetPendingNameUnlessFor('daniel@example.com');
    expect((await readPendingSetup()).firstName).toBeUndefined();
  });

  it('a blank name on Create Account clears an earlier one', async () => {
    await rememberPendingName('rosa@example.com', 'Rosa');
    await rememberPendingName('daniel@example.com', '  ');
    await forgetPendingNameUnlessFor('daniel@example.com');
    expect((await readPendingSetup()).firstName).toBeUndefined();
  });

  it('clearPendingName keeps only the language', async () => {
    await writePendingSetup({ language: 'ko' });
    await rememberPendingName('rosa@example.com', 'Rosa');
    await clearPendingName();
    expect(await readPendingSetup()).toEqual({ language: 'ko', firstName: undefined, email: undefined });
  });
});
