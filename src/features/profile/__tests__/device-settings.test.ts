import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { DEFAULT_PREFS } from '@/features/settings/notification-prefs';

import { carryOverDeviceSettings, DEVICE_NOTIFICATIONS_KEY, deviceAvailabilityKey, type CarryOverDeps } from '../device-settings';
import { draftToWrite, rowToProfile } from '../mapping';
import { createSettingsSync } from '../settings-sync';
import type { KeyValueStorage } from '../store';
import { emptyDraft, type Profile, type ProfileSettings } from '../types';

const sam = (settings: Partial<ProfileSettings> = {}): Profile => ({
  ...rowToProfile({
    id: 'u1',
    verified: true,
    ...draftToWrite({ ...emptyDraft('volunteer'), firstName: 'Sam', gender: 'man', ageBand: 'under_40', privacyAccepted: true }, '2026-11-18T00:00:00.000Z'),
  }),
  ...settings,
});

function memoryStorage(entries: Record<string, string>): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(entries));
  return {
    data,
    getItem: async k => data.get(k) ?? null,
    setItem: async (k, v) => { data.set(k, v); },
    removeItem: async k => { data.delete(k); },
  };
}

/** The profile provider's wiring: a server row, the real settings sync, and what's on screen. */
function provider(stored: Profile, storage: KeyValueStorage, offline = false) {
  const server = { row: stored, offline, saves: 0 };
  let shown = stored;
  const sync = createSettingsSync({
    save: async (_uid, s) => {
      server.saves += 1;
      if (server.offline) throw Object.assign(new Error('Failed to fetch'), { code: '', status: 0 });
      server.row = { ...server.row, ...s };
      return server.row;
    },
    onSaved: () => {},
  });
  sync.setUser(stored.id);
  const deps: CarryOverDeps = {
    storage,
    save: s => {
      shown = { ...shown, ...s };
      sync.change(s);
    },
    idle: () => sync.idle(),
    pending: () => sync.pending(),
    isCurrent: () => true,
  };
  return { server, deps, shown: () => shown };
}

const OFF_NO_VENUE = { [deviceAvailabilityKey('u1')]: 'off', [DEVICE_NOTIFICATIONS_KEY]: JSON.stringify({ ...DEFAULT_PREFS, venue: false }) };

describe('carrying device settings over to the profile', () => {
  // An offline save schedules a retry; fake timers keep it from outliving the test.
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('a volunteer who was Off with venue alerts off stays that way after the upgrade, and the old keys go', async () => {
    const storage = memoryStorage(OFF_NO_VENUE);
    const app = provider(sam(), storage);
    await carryOverDeviceSettings(sam(), app.deps);
    expect(app.shown()).toMatchObject({ availability: 'off', notificationPrefs: { ...DEFAULT_PREFS, venue: false } });
    expect(app.server.row).toMatchObject({ availability: 'off', notificationPrefs: { ...DEFAULT_PREFS, venue: false } });
    expect([...storage.data.keys()]).toEqual([]);
  });

  it('leaves settings the profile already has alone, and still removes the old keys', async () => {
    const storage = memoryStorage(OFF_NO_VENUE);
    const busy = sam({ availability: 'busy', notificationPrefs: { ...DEFAULT_PREFS, chat: false } });
    const app = provider(busy, storage);
    await carryOverDeviceSettings(busy, app.deps);
    expect(app.server.saves).toBe(0);
    expect(app.server.row).toMatchObject({ availability: 'busy', notificationPrefs: { ...DEFAULT_PREFS, chat: false } });
    expect([...storage.data.keys()]).toEqual([]);
  });

  it('offline, shows the old values but keeps the keys so the next start tries again', async () => {
    const storage = memoryStorage(OFF_NO_VENUE);
    const app = provider(sam(), storage, true);
    await carryOverDeviceSettings(sam(), app.deps);
    expect(app.shown().availability).toBe('off');
    expect(storage.data.size).toBe(2);

    const next = provider(sam(), storage); // back online, next start
    await carryOverDeviceSettings(sam(), next.deps);
    expect(next.server.row.availability).toBe('off');
    expect(storage.data.size).toBe(0);
  });

  it("only reads the signed-in user's status, and ignores junk", async () => {
    const storage = memoryStorage({ [deviceAvailabilityKey('u2')]: 'off', [DEVICE_NOTIFICATIONS_KEY]: '{not json' });
    const app = provider(sam(), storage);
    await carryOverDeviceSettings(sam(), app.deps);
    expect(app.server.saves).toBe(0);
    expect([...storage.data.keys()]).toEqual([deviceAvailabilityKey('u2')]);
  });

  it('does nothing when another account signed in meanwhile', async () => {
    const storage = memoryStorage(OFF_NO_VENUE);
    const app = provider(sam(), storage);
    await carryOverDeviceSettings(sam(), { ...app.deps, isCurrent: () => false });
    expect(app.server.saves).toBe(0);
    expect(storage.data.size).toBe(2);
  });
});
