import { describe, expect, it } from '@jest/globals';

import { DEFAULT_PREFS, parseNotificationPrefs } from '../notification-prefs';

describe('notification prefs', () => {
  it('starts with every alert on', () => {
    expect(DEFAULT_PREFS).toEqual({ volunteer: true, chat: true, venue: true, reports: true });
    expect(parseNotificationPrefs(undefined)).toEqual(DEFAULT_PREFS);
    expect(parseNotificationPrefs({})).toEqual(DEFAULT_PREFS);
  });

  it('keeps saved choices', () => {
    expect(parseNotificationPrefs({ volunteer: true, chat: true, venue: false, reports: true })).toEqual({ ...DEFAULT_PREFS, venue: false });
  });

  it('ignores broken or unknown values', () => {
    expect(parseNotificationPrefs({ chat: 'no', reports: false, extra: true })).toEqual({ ...DEFAULT_PREFS, reports: false });
    expect(parseNotificationPrefs([false])).toEqual(DEFAULT_PREFS);
    expect(parseNotificationPrefs('{"chat":false}')).toEqual(DEFAULT_PREFS);
  });

  it('never hands out the shared default object', () => {
    parseNotificationPrefs(null).chat = false;
    expect(DEFAULT_PREFS.chat).toBe(true);
  });
});
