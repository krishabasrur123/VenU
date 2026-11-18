import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { DEFAULT_PREFS } from '@/features/settings/notification-prefs';

import { draftToWrite, rowToProfile, settingsToWrite, type ProfileRow } from '../mapping';
import { createSettingsSync, SETTINGS_RETRY_MS } from '../settings-sync';
import { createLocalStore, type KeyValueStorage } from '../store';
import { emptyDraft, type Profile, type ProfileSettings } from '../types';

const at = '2026-11-18T00:00:00.000Z';
const sam = (id = 'u1'): Profile =>
  rowToProfile({
    id,
    verified: false,
    ...draftToWrite({ ...emptyDraft('volunteer'), firstName: 'Sam', gender: 'man', ageBand: 'under_40', privacyAccepted: true }, at),
  });

/** A fake server: one row per user; `offline` makes saves fail like a dropped connection (code ''). */
function fakeServer() {
  const rows = new Map<string, Profile>([['u1', sam('u1')], ['u2', sam('u2')]]);
  const calls: { userId: string; settings: Partial<ProfileSettings> }[] = [];
  const server = {
    rows,
    calls,
    offline: false,
    reject: false,
    async save(userId: string, settings: Partial<ProfileSettings>): Promise<Profile> {
      calls.push({ userId, settings });
      if (server.offline) throw Object.assign(new Error('Failed to fetch'), { code: '', status: 0 });
      if (server.reject) throw Object.assign(new Error('violates check constraint'), { code: '23514', status: 400 });
      const next = { ...rows.get(userId)!, ...settings };
      rows.set(userId, next);
      return next;
    },
  };
  return server;
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe('settings sync', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('saves a change to the signed-in account and reports the stored profile', async () => {
    const server = fakeServer();
    const saved: Profile[] = [];
    const sync = createSettingsSync({ save: server.save, onSaved: p => saved.push(p) });
    sync.setUser('u1');
    sync.change({ availability: 'busy' });
    await sync.idle();
    expect(server.rows.get('u1')!.availability).toBe('busy');
    expect(saved.map(p => p.availability)).toEqual(['busy']);
    expect(sync.pending()).toEqual({});
  });

  it('keeps an offline change showing over reloads, retries with backoff, and saves it once back online', async () => {
    const server = fakeServer();
    server.offline = true;
    const sync = createSettingsSync({ save: server.save, onSaved: () => {} });
    sync.setUser('u1');
    sync.change({ availability: 'off' });
    await flush();
    expect(server.calls).toHaveLength(1);
    // A reload (profile read from the server) still shows Off.
    expect(sync.overlay(server.rows.get('u1')!).availability).toBe('off');

    jest.advanceTimersByTime(SETTINGS_RETRY_MS);
    await flush();
    expect(server.calls).toHaveLength(2);
    jest.advanceTimersByTime(SETTINGS_RETRY_MS); // the next wait is twice as long: nothing yet
    await flush();
    expect(server.calls).toHaveLength(2);

    server.offline = false;
    jest.advanceTimersByTime(SETTINGS_RETRY_MS);
    await flush();
    expect(server.calls).toHaveLength(3);
    expect(server.rows.get('u1')!.availability).toBe('off');
    expect(sync.pending()).toEqual({});
  });

  it('retries at once on app resume', async () => {
    const server = fakeServer();
    server.offline = true;
    const sync = createSettingsSync({ save: server.save, onSaved: () => {} });
    sync.setUser('u1');
    sync.change({ notificationPrefs: { ...DEFAULT_PREFS, chat: false } });
    await flush();
    server.offline = false;
    await sync.retry();
    expect(server.rows.get('u1')!.notificationPrefs.chat).toBe(false);
  });

  it('saves the newest value when the switch flips again mid-save', async () => {
    const server = fakeServer();
    let release!: () => void;
    const slow = (userId: string, s: Partial<ProfileSettings>) =>
      new Promise<void>(r => (release = r)).then(() => server.save(userId, s));
    const saved: Profile[] = [];
    const sync = createSettingsSync({ save: slow, onSaved: p => saved.push(p) });
    sync.setUser('u1');
    sync.change({ availability: 'busy' });
    sync.change({ availability: 'off' }); // while Busy is still saving
    // The first answer (Busy) arrives, but the screen keeps Off.
    release();
    await flush();
    expect(saved.at(-1)!.availability).toBe('off');
    release();
    await sync.idle();
    expect(server.calls.map(c => c.settings.availability)).toEqual(['busy', 'off']);
    expect(server.rows.get('u1')!.availability).toBe('off');
  });

  it("drops an unsaved change on sign-out and never writes it to the next account", async () => {
    const server = fakeServer();
    server.offline = true;
    const sync = createSettingsSync({ save: server.save, onSaved: () => {} });
    sync.setUser('u1');
    sync.change({ availability: 'off' });
    await flush();
    sync.setUser(null);
    server.offline = false;
    jest.advanceTimersByTime(60_000);
    await flush();
    sync.setUser('u2');
    await sync.retry();
    expect(server.calls.every(c => c.userId === 'u1')).toBe(true);
    expect(server.rows.get('u1')!.availability).toBe('free');
    expect(sync.overlay(server.rows.get('u2')!).availability).toBe('free');
    expect(sync.pending()).toEqual({});
  });

  it("ignores a save that lands after the account changed", async () => {
    const server = fakeServer();
    let release!: () => void;
    const slow = (userId: string, s: Partial<ProfileSettings>) =>
      new Promise<void>(r => (release = r)).then(() => server.save(userId, s));
    const saved: Profile[] = [];
    const sync = createSettingsSync({ save: slow, onSaved: p => saved.push(p) });
    sync.setUser('u1');
    sync.change({ availability: 'busy' });
    sync.setUser('u2');
    release();
    await flush();
    expect(saved).toEqual([]);
  });

  it('drops a change the server refuses outright, without retrying', async () => {
    const server = fakeServer();
    server.reject = true;
    const rejected: unknown[] = [];
    const sync = createSettingsSync({ save: server.save, onSaved: () => {}, onRejected: e => rejected.push(e) });
    sync.setUser('u1');
    sync.change({ availability: 'busy' });
    await sync.idle();
    jest.advanceTimersByTime(60_000);
    await flush();
    expect(server.calls).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(sync.pending()).toEqual({});
  });

  it("leaves another account's profile alone in overlay", () => {
    const sync = createSettingsSync({ save: async () => sam(), onSaved: () => {} });
    sync.setUser('u1');
    sync.change({ availability: 'off' });
    expect(sync.overlay(sam('u2')).availability).toBe('free');
    expect(sync.overlay(null)).toBeNull();
  });
});

describe('settings on the device store (local mode)', () => {
  function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
    const data = new Map<string, string>();
    return {
      data,
      getItem: async k => data.get(k) ?? null,
      setItem: async (k, v) => void data.set(k, v),
      removeItem: async k => void data.delete(k),
    };
  }
  const draft = { ...emptyDraft('volunteer'), firstName: 'Sam', gender: 'man' as const, ageBand: 'under_40' as const, privacyAccepted: true };

  it('round-trips settings, and a profile form save keeps them', async () => {
    const storage = memoryStorage();
    const store = createLocalStore(storage);
    const created = await store.save('u1', draft, null);
    expect(created.availability).toBe('free');
    expect(created.notificationPrefs).toEqual(DEFAULT_PREFS);

    await store.saveSettings('u1', { availability: 'busy', notificationPrefs: { ...DEFAULT_PREFS, venue: false } });
    // The form was opened before the change (its `existing` still says Free).
    const edited = await store.save('u1', { ...draft, firstName: 'Samuel' }, created);
    expect(edited.firstName).toBe('Samuel');
    expect(edited.availability).toBe('busy');
    expect(edited.notificationPrefs.venue).toBe(false);
    expect((await store.get('u1'))!.availability).toBe('busy');
  });

  it('reads rows saved before settings existed with the defaults', async () => {
    const storage = memoryStorage();
    const row: ProfileRow = { id: 'u1', verified: false, ...draftToWrite(draft, at) };
    storage.data.set('venu.profile.u1', JSON.stringify(row));
    const store = createLocalStore(storage);
    const p = (await store.get('u1'))!;
    expect(p.availability).toBe('free');
    expect(p.notificationPrefs).toEqual(DEFAULT_PREFS);
  });
});

describe('settingsToWrite', () => {
  it('writes only what changed, as DB columns', () => {
    expect(settingsToWrite({ availability: 'off' })).toEqual({ availability: 'off' });
    expect(settingsToWrite({ notificationPrefs: { ...DEFAULT_PREFS, chat: false } })).toEqual({ notification_prefs: { ...DEFAULT_PREFS, chat: false } });
    expect(settingsToWrite({})).toEqual({});
  });
});
