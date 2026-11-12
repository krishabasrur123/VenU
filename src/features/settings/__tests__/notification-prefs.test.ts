import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_PREFS, loadNotificationPrefs, NOTIFICATION_KEY, saveNotificationPrefs } from '../notification-prefs';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('notification prefs', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('starts with every alert on', async () => {
    expect(await loadNotificationPrefs()).toEqual(DEFAULT_PREFS);
  });

  it('round-trips a change under one key', async () => {
    await saveNotificationPrefs({ ...DEFAULT_PREFS, venue: false });
    expect(await loadNotificationPrefs()).toEqual({ volunteer: true, chat: true, venue: false, reports: true });
    expect(await AsyncStorage.getAllKeys()).toEqual([NOTIFICATION_KEY]);
  });

  it('ignores broken or unknown values', async () => {
    await AsyncStorage.setItem(NOTIFICATION_KEY, JSON.stringify({ chat: 'no', reports: false, extra: true }));
    expect(await loadNotificationPrefs()).toEqual({ ...DEFAULT_PREFS, reports: false });
    await AsyncStorage.setItem(NOTIFICATION_KEY, '{not json');
    expect(await loadNotificationPrefs()).toEqual(DEFAULT_PREFS);
  });
});
