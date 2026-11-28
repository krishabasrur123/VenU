import { describe, expect, it } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';

import { draftToWrite, rowToProfile, type ProfileRow } from '../mapping';
import { isKnownLanguage, isolate, isolatedLanguageName, searchLanguages } from '../options';
import { PRIVACY_VERSION } from '../privacy';
import { base64ToArrayBuffer, checkPhoto, createLocalStore, createSupabaseStore, saveWithAvatar, setAppLanguageIfCurrent, type KeyValueStorage, type PendingUpload, type ProfileStore } from '../store';
import { helperSummary, initials, uiLanguageName } from '../summary';
import { draftFromProfile, emptyDraft, homeFor, sameDraft, type ProfileDraft } from '../types';
import { isValid, validateDraft } from '../validate';
import i18n from '@/i18n';
import { codedError, friendlyError } from '@/lib/errors';

const rosa: ProfileDraft = {
  ...emptyDraft('visitor', 'es'),
  firstName: '  Rosa ',
  languages: ['es', 'en'],
  accessNeeds: ['wheelchair'],
  privacyAccepted: true,
};

const daniel: ProfileDraft = {
  ...emptyDraft('volunteer', 'en'),
  firstName: 'Daniel',
  languages: ['en', 'es'],
  trainings: ['wheelchair'],
  gender: 'man',
  ageBand: 'under_40',
  privacyAccepted: true,
};

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async k => data.get(k) ?? null,
    setItem: async (k, v) => void data.set(k, v),
    removeItem: async k => void data.delete(k),
  };
}

describe('validateDraft', () => {
  it('accepts complete visitor and volunteer drafts', () => {
    expect(validateDraft(rosa)).toEqual({});
    expect(validateDraft(daniel)).toEqual({});
  });

  it('flags every missing required field for a blank draft', () => {
    const errors = validateDraft({ ...emptyDraft('volunteer'), languages: [] });
    expect(Object.keys(errors).sort()).toEqual(['ageBand', 'firstName', 'gender', 'languages', 'privacyAccepted']);
    expect(isValid(errors)).toBe(false);
  });

  it('requires the main language to be in the list', () => {
    expect(validateDraft({ ...rosa, mainLanguage: 'ko' }).languages).toBe('Pick your main language.');
  });

  it('needs a note only when "Other" is picked', () => {
    expect(validateDraft({ ...rosa, accessNeeds: ['other'] }).accessNeedsNote).toBeDefined();
    expect(validateDraft({ ...rosa, accessNeeds: ['other'], accessNeedsNote: 'Service dog' })).toEqual({});
  });

  it("doesn't ask visitors for volunteer fields", () => {
    expect(validateDraft({ ...rosa, gender: null, ageBand: null })).toEqual({});
  });
});

describe('draftToWrite / rowToProfile', () => {
  const at = '2026-11-09T00:00:00.000Z';

  it('round-trips a visitor and trims the name', () => {
    const row: ProfileRow = { id: 'u1', verified: false, ...draftToWrite(rosa, at) };
    const profile = rowToProfile(row);
    expect(profile.firstName).toBe('Rosa');
    expect(profile.privacyVersion).toBe(PRIVACY_VERSION);
    expect(draftFromProfile(profile)).toEqual({ ...rosa, firstName: 'Rosa' });
  });

  it('clears fields that belong to the other role', () => {
    const visitorWithStrayData = { ...rosa, trainings: ['asl' as const], gender: 'woman' as const, accessNeedsNote: 'stale' };
    const w = draftToWrite(visitorWithStrayData, at);
    expect(w.trainings).toEqual([]);
    expect(w.gender).toBeNull();
    expect(w.access_needs_note).toBeNull(); // "other" not selected

    const v = draftToWrite({ ...daniel, accessNeeds: ['wheelchair'], helperGenderPref: 'woman' }, at);
    expect(v.access_needs).toEqual([]);
    expect(v.helper_gender_pref).toBe('none');
    expect(v.trainings).toEqual(['wheelchair']);
  });
});

describe('saving the profile form', () => {
  it('never changes the app language of an existing profile (local store)', async () => {
    // Edit profile opened in Arabic; the venue pill then saved 한국어; the form saves with its old draft.
    const storage = memoryStorage();
    const store = createLocalStore(storage);
    const created = await store.save('u1', { ...rosa, appLanguage: 'ar' }, null);
    expect(created.appLanguage).toBe('ar'); // a new profile takes the draft's
    await store.setAppLanguage('u1', 'ko');
    const edited = await store.save('u1', { ...rosa, languages: ['es', 'en', 'fr'], appLanguage: 'ar' }, created);
    expect(edited.appLanguage).toBe('ko');
    expect(edited.languages).toEqual(['es', 'en', 'fr']);
  });
});

describe('local store', () => {
  it('saves, reads back, keeps role and consent time on edit, and deletes', async () => {
    const storage = memoryStorage();
    const store = createLocalStore(storage);

    expect(await store.get('u1')).toBeNull();
    const created = await store.save('u1', rosa, null);
    expect(created.verified).toBe(false);
    expect(await store.get('u1')).toEqual(created);

    const edited = await store.save('u1', { ...rosa, role: 'volunteer', firstName: 'Rosa M' }, created);
    expect(edited.firstName).toBe('Rosa M');
    expect(edited.role).toBe('visitor');
    expect(edited.privacyAcceptedAt).toBe(created.privacyAcceptedAt);

    await store.deleteAll('u1');
    expect(await store.get('u1')).toBeNull();
    expect(storage.data.size).toBe(0);
  });

  it('changes only the app language, leaving an old consent as it was', async () => {
    const storage = memoryStorage();
    const store = createLocalStore(storage);
    const created = await store.save('u1', rosa, null);
    const old = { ...JSON.parse(storage.data.get('venu.profile.u1')!), privacy_version: '2020-01', privacy_accepted_at: '2020-01-01T00:00:00.000Z' };
    storage.data.set('venu.profile.u1', JSON.stringify(old));
    const saved = await store.setAppLanguage('u1', 'ko');
    expect(saved).toEqual({ ...created, appLanguage: 'ko', privacyVersion: '2020-01', privacyAcceptedAt: '2020-01-01T00:00:00.000Z' });
    expect(await store.get('u1')).toEqual(saved);
    await expect(store.setAppLanguage('nobody', 'ko')).rejects.toThrow();
  });

  it('drops unreadable saved data instead of failing every launch', async () => {
    const storage = memoryStorage();
    storage.data.set('venu.profile.u1', '{not json');
    expect(await createLocalStore(storage).get('u1')).toBeNull();
    expect(storage.data.has('venu.profile.u1')).toBe(false);
  });

  it('drops a parseable but malformed row (e.g. an old format) too', async () => {
    const storage = memoryStorage();
    storage.data.set('venu.profile.u1', JSON.stringify({ id: 'u1', first_name: 'Rosa' })); // no role or languages
    expect(await createLocalStore(storage).get('u1')).toBeNull();
    expect(storage.data.has('venu.profile.u1')).toBe(false);
  });

  it('keeps web photos as data URIs so they survive a reload', async () => {
    const store = createLocalStore(memoryStorage());
    expect(await store.uploadAvatar('u1', { uri: 'blob:x', mimeType: 'image/png', base64: 'AAA' })).toBe('data:image/png;base64,AAA');
    expect(await store.uploadAvatar('u1', { uri: 'file:///a.jpg', mimeType: null })).toBe('file:///a.jpg');
  });
});

describe('helperSummary', () => {
  const t = i18n.getFixedT('en', 'profile');
  it('lists main language first, then needs (visitor)', () => {
    expect(helperSummary({ ...rosa, communication: ['speaking', 'text'] }, t)).toEqual([
      'Speaks Spanish, English',
      'Wheelchair user',
      'Prefers text / writing',
    ]);
  });

  it('lists languages and training (volunteer)', () => {
    expect(helperSummary(daniel, t)).toEqual(['Speaks English, Spanish', 'Wheelchair trained']);
  });
});

describe('small helpers', () => {
  it('initials', () => {
    expect(initials('Daniel Martinez')).toBe('DM');
    expect(initials('rosa')).toBe('R');
    expect(initials('  ')).toBe('?');
    expect(initials('😀 Rosa')).toBe('😀R'); // whole emoji, not a lone surrogate
    expect(initials('李 小龙')).toBe('李小');
  });

  it('wraps language names in Unicode isolates so RTL names keep chip order', () => {
    expect(isolate('Arabic')).toBe('\u2068Arabic\u2069'); // a name in the UI language, e.g. on incoming requests
    expect(isolatedLanguageName('fa')).toBe('\u2068فارسی\u2069');
    expect(`${isolatedLanguageName('ar')} · main`).toBe('\u2068العربية\u2069 · main');
  });

  it('language search ignores case and accents and matches English names', () => {
    expect(searchLanguages('espanol').map(l => l.code)).toEqual(['es']);
    expect(searchLanguages('KOREAN').map(l => l.code)).toEqual(['ko']);
    expect(searchLanguages('sign').map(l => l.code)).toEqual(['ase']);
    // The name in the UI language matches too (Korean UI: 스페인어 = Spanish), without losing English.
    const ko = i18n.getFixedT('ko', 'profile');
    const koName = (code: string) => uiLanguageName(code, ko);
    expect(searchLanguages('스페인어', koName).map(l => l.code)).toEqual(['es']);
    expect(searchLanguages('스페인어').map(l => l.code)).toEqual([]);
    expect(searchLanguages('spanish', koName).map(l => l.code)).toEqual(['es']);
  });
});

describe('review fixes', () => {
  const at = '2026-11-09T00:00:00.000Z';
  const saved = rowToProfile({ id: 'u1', verified: false, ...draftToWrite(rosa, at) });

  it('asks for consent again once the policy version changes', () => {
    expect(draftFromProfile(saved).privacyAccepted).toBe(true);
    expect(draftFromProfile({ ...saved, privacyVersion: 'old-version' }).privacyAccepted).toBe(false);
  });

  it('counts a chip ticked off and on again as no change (Edit profile asks before Back only when dirty)', () => {
    const before: ProfileDraft = { ...rosa, accessNeeds: ['wheelchair', 'low_vision'], communication: ['text', 'speaking'] };
    const after: ProfileDraft = { ...before, accessNeeds: ['low_vision', 'wheelchair'], communication: ['speaking', 'text'] };
    expect(sameDraft(before, after)).toBe(true);
    expect(sameDraft(before, { ...before, accessNeeds: ['wheelchair'] })).toBe(false);
    expect(sameDraft(before, { ...before, accessNeeds: ['wheelchair', 'hard_of_hearing'] })).toBe(false);
    expect(sameDraft(before, { ...before, firstName: 'Rosa M' })).toBe(false);
    expect(sameDraft(daniel, { ...daniel, trainings: ['wheelchair', 'asl'] })).toBe(false);
  });

  it('sends each role to its own home tab', () => {
    expect(homeFor({ role: 'visitor' })).toBe('/venue');
    expect(homeFor({ role: 'volunteer' })).toBe('/volunteer');
  });

  it('turns a storage quota error on a photo into a readable message', async () => {
    const full: KeyValueStorage = { ...memoryStorage(), setItem: async () => { throw new Error('QuotaExceededError'); } };
    const store = createLocalStore(full);
    const tooBig = store.save('u1', { ...rosa, avatarPath: 'data:image/png;base64,AAA' }, null);
    await expect(tooBig).rejects.toMatchObject({ code: 'VENU_PHOTO_TOO_BIG_LOCAL' });
    await tooBig.catch(e => expect(friendlyError(e)).toBe('That photo is too big to keep on this device. Try a smaller one.'));
    await expect(store.save('u1', rosa, null)).rejects.toThrow('QuotaExceededError');
  });
});

describe('supabase store', () => {
  function fakeClient({ listError = null as Error | null, removeError = null as Error | null, fileCount = 1 } = {}) {
    const calls: string[] = [];
    const files = Array.from({ length: fileCount }, (_, i) => ({ name: fileCount === 1 ? 'avatar' : `avatar-${i}` }));
    const bucket = {
      list: async (dir: string, o: { limit?: number; offset?: number } = {}) => {
        calls.push(`list ${dir}${o.offset ? ` @${o.offset}` : ''}`);
        const page = files.slice(o.offset ?? 0, (o.offset ?? 0) + (o.limit ?? 100));
        return { data: listError ? null : page, error: listError };
      },
      remove: async (paths: string[]) => (calls.push(paths.length > 3 ? `remove ${paths.length} files` : `remove ${paths.join(',')}`), { data: null, error: removeError }),
      upload: async (path: string, _b: ArrayBuffer, o: { contentType: string; upsert?: boolean }) => (
        calls.push(`upload ${path} ${o.contentType}${o.upsert ? ' UPSERT' : ''}`), { error: null }
      ),
    };
    const client = {
      storage: { from: () => bucket },
      from: () => ({ delete: () => ({ eq: async (_c: string, id: string) => (calls.push(`delete row ${id}`), { error: null }) }) }),
    };
    return { client: client as unknown as SupabaseClient, calls };
  }

  it('sweeps the photos, then deletes the row', async () => {
    const { client, calls } = fakeClient();
    await createSupabaseStore(client, 'avatars').deleteAll('u1');
    expect(calls).toEqual(['list u1', 'remove u1/avatar', 'delete row u1']);
  });

  it('deletes every photo across list pages, not just the first 100', async () => {
    const { client, calls } = fakeClient({ fileCount: 150 });
    await createSupabaseStore(client, 'avatars').deleteAll('u1');
    expect(calls).toEqual(['list u1', 'list u1 @100', 'remove 150 files', 'delete row u1']);
  });

  it('a failed photo sweep stops before the row, so the profile still exists and a retry finishes', async () => {
    for (const opts of [{ listError: new Error('list failed') }, { removeError: new Error('remove failed') }]) {
      const { client, calls } = fakeClient(opts);
      await expect(createSupabaseStore(client, 'avatars').deleteAll('u1')).rejects.toThrow('failed');
      expect(calls).not.toContain('delete row u1');
    }
  });

  it('a picked photo that can no longer be read is its own error, not "offline"', async () => {
    const { client, calls } = fakeClient();
    const realFetch = globalThis.fetch;
    // What a web blob: URL does after a reload.
    globalThis.fetch = (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    try {
      const upload = createSupabaseStore(client, 'avatars').uploadAvatar('u1', { uri: 'blob:http://localhost/dead', mimeType: 'image/png' });
      await expect(upload).rejects.toMatchObject({ code: 'VENU_PHOTO_UNREADABLE' });
      await upload.catch(e => expect(friendlyError(e)).toBe("Couldn't read that photo. Pick it again."));
      expect(calls).toEqual([]); // nothing uploaded
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it('uploads each photo to a fresh path in the user folder', async () => {
    const { client, calls } = fakeClient();
    const store = createSupabaseStore(client, 'avatars');
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({ arrayBuffer: async () => new ArrayBuffer(1) })) as unknown as typeof fetch;
    try {
      const a = await store.uploadAvatar('u1', { uri: 'file:///a.png', mimeType: 'image/png' });
      await new Promise(r => setTimeout(r, 2));
      const b = await store.uploadAvatar('u1', { uri: 'file:///b.jpg', mimeType: 'image/jpeg' });
      expect(a).toMatch(/^u1\/avatar-\d+$/);
      expect(b).toMatch(/^u1\/avatar-\d+$/);
      expect(a).not.toBe(b);
      expect(calls).toEqual([`upload ${a} image/png`, `upload ${b} image/jpeg`]);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe('setAppLanguageIfCurrent', () => {
  it('reports a save that finished after another account signed in as stale (null)', async () => {
    let current: string | null = 'rosa';
    const store = createLocalStore(memoryStorage());
    await store.save('rosa', rosa, null);
    const wrapped: ProfileStore = { ...store, setAppLanguage: async (u, c) => { current = 'daniel'; return store.setAppLanguage(u, c); } };
    expect(await setAppLanguageIfCurrent(wrapped, 'rosa', 'ko', () => current)).toBeNull();
    current = 'rosa';
    expect((await setAppLanguageIfCurrent(store, 'rosa', 'ja', () => current))?.appLanguage).toBe('ja');
  });
});

describe('saveWithAvatar', () => {
  const at = '2026-11-09T00:00:00.000Z';
  const existing = rowToProfile({ id: 'u1', verified: false, ...draftToWrite({ ...rosa, avatarPath: 'u1/avatar-old' }, at) });

  // saveFails: 'rejected' = server said no (PostgREST error with a code); 'network' = outcome unknown.
  function fakeStore({ saveFails = false as false | 'rejected' | 'network', removeFails = false } = {}) {
    const calls: string[] = [];
    const store: ProfileStore = {
      get: async () => null,
      save: async (_u, d) => {
        calls.push(`save ${d.avatarPath}`);
        if (saveFails === 'rejected') throw Object.assign(new Error('save failed'), { code: '23514' });
        if (saveFails === 'network') throw new TypeError('Failed to fetch');
        return { ...existing, avatarPath: d.avatarPath };
      },
      uploadAvatar: async () => (calls.push('upload'), 'u1/avatar-new'),
      removeAvatar: async p => { calls.push(`remove ${p}`); if (removeFails) throw new Error('remove failed'); },
      avatarUrl: async p => p,
      deleteAll: async () => {},
      setAppLanguage: async () => { throw new Error('not used'); },
      saveSettings: async () => { throw new Error('not used'); },
    };
    return { store, calls };
  }
  const pick = { uri: 'file:///n.jpg', mimeType: 'image/jpeg' };

  it('new photo: upload, save, then delete the old file', async () => {
    const { store, calls } = fakeStore();
    const saved = await saveWithAvatar(store, 'u1', rosa, pick, existing);
    expect(calls).toEqual(['upload', 'save u1/avatar-new', 'remove u1/avatar-old']);
    expect(saved.avatarPath).toBe('u1/avatar-new');
  });

  it('rejected save keeps the old photo and cleans up the new upload', async () => {
    const { store, calls } = fakeStore({ saveFails: 'rejected' });
    await expect(saveWithAvatar(store, 'u1', rosa, pick, existing)).rejects.toThrow('save failed');
    expect(calls).toEqual(['upload', 'save u1/avatar-new', 'remove u1/avatar-new']);
  });

  it('postgrest transport failure (code "") also keeps the new upload', async () => {
    const calls: string[] = [];
    const store: ProfileStore = {
      get: async () => null,
      save: async () => { calls.push('save'); throw { code: '', message: 'TypeError: Failed to fetch', details: '', hint: '' }; },
      uploadAvatar: async () => (calls.push('upload'), 'u1/avatar-new'),
      removeAvatar: async p => void calls.push(`remove ${p}`),
      avatarUrl: async p => p,
      deleteAll: async () => {},
      setAppLanguage: async () => { throw new Error('not used'); },
      saveSettings: async () => { throw new Error('not used'); },
    };
    await expect(saveWithAvatar(store, 'u1', rosa, pick, existing)).rejects.toMatchObject({ code: '' });
    expect(calls).toEqual(['upload', 'save']);
  });

  it('network failure keeps the new upload too (the row may have committed pointing at it)', async () => {
    const { store, calls } = fakeStore({ saveFails: 'network' });
    await expect(saveWithAvatar(store, 'u1', rosa, pick, existing)).rejects.toThrow('Failed to fetch');
    expect(calls).toEqual(['upload', 'save u1/avatar-new']);
  });

  it('remove: clears the row first, deletes the file only after', async () => {
    const { store, calls } = fakeStore();
    await saveWithAvatar(store, 'u1', rosa, 'remove', existing);
    expect(calls).toEqual(['save null', 'remove u1/avatar-old']);
    const failing = fakeStore({ saveFails: 'rejected' });
    await expect(saveWithAvatar(failing.store, 'u1', rosa, 'remove', existing)).rejects.toThrow();
    expect(failing.calls).toEqual(['save null']); // photo untouched
  });

  it('no change keeps the path; a failed old-file cleanup still saves', async () => {
    const same = fakeStore();
    expect((await saveWithAvatar(same.store, 'u1', rosa, null, existing)).avatarPath).toBe('u1/avatar-old');
    expect(same.calls).toEqual(['save u1/avatar-old']);
    const flaky = fakeStore({ removeFails: true });
    expect((await saveWithAvatar(flaky.store, 'u1', rosa, pick, existing)).avatarPath).toBe('u1/avatar-new');
  });
});

describe('friendlyError', () => {
  it('turns network and auth errors into plain sentences', () => {
    const offline = "Can't reach VenU. Check your connection and try again.";
    expect(friendlyError(new TypeError('Failed to fetch'))).toBe(offline);
    expect(friendlyError({ name: 'AuthRetryableFetchError', message: '{}' })).toBe(offline);
    expect(friendlyError(new Error('Invalid login credentials'))).toBe('Wrong username or password.');
    // A policy refusal isn't a session problem, so it mustn't say "session expired".
    expect(friendlyError({ message: 'new row violates row-level security policy for table "profiles"' })).toBe(
      "VenU couldn't save that change. If it keeps happening, sign out and back in.",
    );
    expect(friendlyError({ message: 'JWT expired' })).toBe('Your session expired. Please sign in again.');
    expect(friendlyError({ message: 'The object exceeded the maximum allowed size' })).toBe('That photo is over 5 MB. Pick a smaller one.');
    expect(friendlyError({ message: 'mime type image/gif is not supported' })).toBe('Use a JPG, PNG, WebP or HEIC photo.');
  });

  it('never shows an unrecognised raw message, and falls back when there is none', () => {
    expect(friendlyError(new Error('Some English message from a library'))).toBe('Something went wrong. Try again.');
    expect(friendlyError(undefined)).toBe('Something went wrong. Try again.');
    expect(friendlyError({}, 'Custom fallback')).toBe('Custom fallback');
  });
});

describe('checkPhoto', () => {
  it('matches the avatars bucket rules and lets unknowns through', () => {
    expect(checkPhoto({ mimeType: 'image/jpeg', fileSize: 1_000_000 })).toBeNull();
    expect(checkPhoto({ mimeType: 'image/HEIC', fileSize: null })).toBeNull();
    expect(checkPhoto({ mimeType: null, fileSize: null })).toBeNull();
    expect(checkPhoto({ mimeType: 'image/gif', fileSize: 10 })).toBe('Use a JPG, PNG, WebP or HEIC photo.');
    expect(checkPhoto({ mimeType: 'image/png', fileSize: 6 * 1024 * 1024 })).toBe('That photo is over 5 MB. Pick a smaller one.');
  });
});

describe('supabase store save', () => {
  const row = { id: 'u1', verified: false, ...draftToWrite(rosa, '2026-11-09T00:00:00.000Z') };
  type Result = { data: unknown; error: unknown };
  const ok: Result = { data: row, error: null };

  // Minimal PostgREST chain: insert(...).select().single(), update(...).eq().select().single(),
  // and select('role').eq().single() for the duplicate-key role check.
  function tableClient({ insert = ok, update = ok, storedRole = 'visitor' }: { insert?: Result; update?: Result; storedRole?: string } = {}) {
    const calls: string[] = [];
    const single = (name: string, result: Result) => ({ select: () => ({ single: async () => (calls.push(name), result) }) });
    const client = {
      from: () => ({
        insert: (r: { role?: string }) => single(`insert role=${r.role}`, insert),
        update: (r: { role?: string }) => ({ eq: () => single(`update role=${'role' in r ? r.role : 'omitted'}`, update) }),
        select: () => ({ eq: () => ({ single: async () => (calls.push('read role'), { data: { role: storedRole }, error: null }) }) }),
      }),
    };
    return { client: client as unknown as SupabaseClient, calls };
  }
  const duplicate: Result = { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };

  it('an update leaves app_language out (the pills own it); an insert includes it', async () => {
    const writes: Record<string, unknown>[] = [];
    const client = {
      from: () => ({
        update: (r: Record<string, unknown>) => (writes.push(r), { eq: () => ({ select: () => ({ single: async () => ({ data: row, error: null }) }) }) }),
        insert: (r: Record<string, unknown>) => (writes.push(r), { select: () => ({ single: async () => ({ data: row, error: null }) }) }),
      }),
    };
    const store = createSupabaseStore(client as unknown as SupabaseClient, 'avatars');
    await store.save('u1', { ...rosa, appLanguage: 'ar' }, rowToProfile(row));
    await store.save('u1', { ...rosa, appLanguage: 'ar' }, null);
    expect(writes.map(w => 'app_language' in w)).toEqual([false, true]);
  });

  it('first save inserts with the role', async () => {
    const { client, calls } = tableClient();
    await createSupabaseStore(client, 'avatars').save('u1', rosa, null);
    expect(calls).toEqual(['insert role=visitor']);
  });

  it('duplicate key with the same role falls back to update (without role)', async () => {
    const { client, calls } = tableClient({ insert: duplicate });
    const saved = await createSupabaseStore(client, 'avatars').save('u1', rosa, null);
    expect(calls).toEqual(['insert role=visitor', 'read role', 'update role=omitted']);
    expect(saved.firstName).toBe('Rosa');
  });

  it('duplicate key with a different role stops instead of merging two roles', async () => {
    const { client, calls } = tableClient({ insert: duplicate, storedRole: 'volunteer' });
    await expect(createSupabaseStore(client, 'avatars').save('u1', rosa, null)).rejects.toMatchObject({ code: 'VENU_ROLE_MISMATCH', role: 'volunteer' });
    expect(calls).toEqual(['insert role=visitor', 'read role']); // no update
  });

  it('update of a row deleted elsewhere (PGRST116) recreates it', async () => {
    const existing = rowToProfile(row);
    const { client, calls } = tableClient({ update: { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } } });
    await createSupabaseStore(client, 'avatars').save('u1', rosa, existing);
    expect(calls).toEqual(['update role=omitted', 'insert role=visitor']);
  });

  it('a language change updates only app_language (no consent re-stamp)', async () => {
    const writes: unknown[] = [];
    const client = {
      from: () => ({
        update: (r: unknown) => (writes.push(r), { eq: () => ({ select: () => ({ single: async () => ({ data: { ...row, app_language: 'ko' }, error: null, status: 200 }) }) }) }),
      }),
    };
    const saved = await createSupabaseStore(client as unknown as SupabaseClient, 'avatars').setAppLanguage('u1', 'ko');
    expect(writes).toEqual([{ app_language: 'ko' }]);
    expect(saved.appLanguage).toBe('ko');
  });

  it('other insert errors still throw', async () => {
    const { client } = tableClient({ insert: { data: null, error: { code: '23514', message: 'violates check constraint' } } });
    await expect(createSupabaseStore(client, 'avatars').save('u1', rosa, null)).rejects.toMatchObject({ code: '23514' });
  });
});

describe('saveWithAvatar retries after a network failure', () => {
  const at = '2026-11-09T00:00:00.000Z';
  const existing = rowToProfile({ id: 'u1', verified: false, ...draftToWrite({ ...rosa, avatarPath: 'u1/avatar-old' }, at) });

  // save() fails on the network `failures` times, then succeeds. Uploads get numbered paths.
  function flakyStore(failures: number) {
    const calls: string[] = [];
    let n = 0;
    const store: ProfileStore = {
      get: async () => null,
      save: async (_u, d) => {
        calls.push(`save ${d.avatarPath}`);
        if (failures-- > 0) throw new TypeError('Failed to fetch');
        return { ...existing, avatarPath: d.avatarPath };
      },
      uploadAvatar: async () => { n += 1; calls.push(`upload #${n}`); return `u1/avatar-${n}`; },
      removeAvatar: async p => void calls.push(`remove ${p}`),
      avatarUrl: async p => p,
      deleteAll: async () => {},
      setAppLanguage: async () => { throw new Error('not used'); },
      saveSettings: async () => { throw new Error('not used'); },
    };
    return { store, calls };
  }
  const photo = { uri: 'file:///same.jpg', mimeType: 'image/jpeg' };

  it('reuses the kept upload when retrying with the same photo', async () => {
    const { store, calls } = flakyStore(1);
    const pending = { current: [] as PendingUpload[] };
    await expect(saveWithAvatar(store, 'u1', rosa, photo, existing, pending)).rejects.toThrow('Failed to fetch');
    expect(pending.current).toEqual([{ uri: 'file:///same.jpg', path: 'u1/avatar-1' }]);
    const saved = await saveWithAvatar(store, 'u1', rosa, photo, existing, pending);
    expect(saved.avatarPath).toBe('u1/avatar-1');
    expect(calls).toEqual(['upload #1', 'save u1/avatar-1', 'save u1/avatar-1', 'remove u1/avatar-old']); // one upload
    expect(pending.current).toEqual([]);
  });

  it('a different photo on retry uploads anew and cleans up the superseded upload', async () => {
    const { store, calls } = flakyStore(1);
    const pending = { current: [] as PendingUpload[] };
    await expect(saveWithAvatar(store, 'u1', rosa, photo, existing, pending)).rejects.toThrow();
    await saveWithAvatar(store, 'u1', rosa, { uri: 'file:///other.jpg', mimeType: 'image/jpeg' }, existing, pending);
    expect(calls).toEqual(['upload #1', 'save u1/avatar-1', 'upload #2', 'save u1/avatar-2', 'remove u1/avatar-1', 'remove u1/avatar-old']);
  });

  it('choosing Remove on retry also cleans up the kept upload', async () => {
    const { store, calls } = flakyStore(1);
    const pending = { current: [] as PendingUpload[] };
    await expect(saveWithAvatar(store, 'u1', rosa, photo, existing, pending)).rejects.toThrow();
    await saveWithAvatar(store, 'u1', rosa, 'remove', existing, pending);
    expect(calls).toEqual(['upload #1', 'save u1/avatar-1', 'save null', 'remove u1/avatar-1', 'remove u1/avatar-old']);
  });

  it('two network failures with different photos keep both, and success cleans up the unused one', async () => {
    const { store, calls } = flakyStore(2);
    const pending = { current: [] as PendingUpload[] };
    await expect(saveWithAvatar(store, 'u1', rosa, photo, existing, pending)).rejects.toThrow();
    const other = { uri: 'file:///other.jpg', mimeType: 'image/jpeg' };
    await expect(saveWithAvatar(store, 'u1', rosa, other, existing, pending)).rejects.toThrow();
    expect(pending.current.map(u => u.path)).toEqual(['u1/avatar-1', 'u1/avatar-2']);
    await saveWithAvatar(store, 'u1', rosa, other, existing, pending); // reuses #2
    expect(calls.slice(-3)).toEqual(['save u1/avatar-2', 'remove u1/avatar-1', 'remove u1/avatar-old']);
  });

  it('a server rejection on retry keeps a reused upload (an earlier lost save may point at it)', async () => {
    const calls: string[] = [];
    let attempt = 0;
    const store: ProfileStore = {
      get: async () => null,
      save: async () => {
        attempt += 1;
        calls.push(`save #${attempt}`);
        if (attempt === 1) throw new TypeError('Failed to fetch');
        throw Object.assign(new Error('rejected'), { code: 'PGRST301' });
      },
      uploadAvatar: async () => (calls.push('upload'), 'u1/avatar-1'),
      removeAvatar: async p => void calls.push(`remove ${p}`),
      avatarUrl: async p => p,
      deleteAll: async () => {},
      setAppLanguage: async () => { throw new Error('not used'); },
      saveSettings: async () => { throw new Error('not used'); },
    };
    const pending = { current: [] as PendingUpload[] };
    await expect(saveWithAvatar(store, 'u1', rosa, photo, existing, pending)).rejects.toThrow();
    await expect(saveWithAvatar(store, 'u1', rosa, photo, existing, pending)).rejects.toThrow('rejected');
    expect(calls).toEqual(['upload', 'save #1', 'save #2']); // never removed
    expect(pending.current).toHaveLength(1);
  });
});

describe('round five details', () => {
  it('role-mismatch errors carry a code, so the new upload counts as rejected', async () => {
    const row = { id: 'u1', verified: false, ...draftToWrite(rosa, '2026-11-09T00:00:00.000Z') };
    const client = {
      from: () => ({
        insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { code: '23505', message: 'duplicate' } }) }) }),
        select: () => ({ eq: () => ({ single: async () => ({ data: { role: 'volunteer' }, error: null }) }) }),
        update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: row, error: null }) }) }) }),
      }),
    } as unknown as SupabaseClient;
    await expect(createSupabaseStore(client, 'avatars').save('u1', rosa, null)).rejects.toMatchObject({ code: 'VENU_ROLE_MISMATCH' });
  });

  it('only known language codes are accepted from a URL', () => {
    expect(isKnownLanguage('es')).toBe(true);
    expect(isKnownLanguage('ase')).toBe(true);
    expect(isKnownLanguage('xx')).toBe(false);
    expect(isKnownLanguage(undefined)).toBe(false);
  });
});

describe('round six details', () => {
  it('hides raw database/storage messages but keeps human ones', () => {
    const generic = 'Something went wrong. Try again.';
    expect(friendlyError({ code: '23514', message: 'new row violates check constraint "main_language_listed" for relation "profiles"', details: null, hint: null })).toBe(generic);
    expect(friendlyError(Object.assign(new Error('The resource already exists'), { name: 'StorageApiError' }))).toBe(generic);
    // Our own coded errors and known Supabase Auth errors get a sentence from the string table.
    expect(friendlyError(codedError('roleMismatch', { role: 'volunteer' }))).toBe('This account is already set up as a volunteer. Reload the app to continue.');
    expect(friendlyError(codedError('roleMismatch', { role: 'visitor' }))).toBe('This account is already set up as a visitor. Reload the app to continue.');
    expect(friendlyError(codedError('photoTooBigLocal'))).toBe('That photo is too big to keep on this device. Try a smaller one.');
    expect(friendlyError(Object.assign(new Error('Password should be at least 6 characters.'), { name: 'AuthApiError', code: 'weak_password' }))).toBe(
      'That password is too easy to guess. Try a longer one.',
    );
    // Same messages without a code (older servers), and an unknown auth message.
    expect(friendlyError(Object.assign(new Error('Password should contain at least one character of each: abc'), { name: 'AuthApiError' }))).toBe('That password is too easy to guess. Try a longer one.');
    expect(friendlyError({ name: 'AuthApiError', message: 'For security purposes, you can only request this after 42 seconds.' })).toBe('Too many tries. Wait a minute and try again.');
    expect(friendlyError({ name: 'AuthApiError', code: 'email_address_invalid', message: 'Email address "x@y" is invalid' })).toBe("That email address doesn't look right. Check it and try again.");
    expect(friendlyError({ name: 'AuthApiError', message: 'Some brand new auth failure' })).toBe(generic); // only truly unknown ones
  });

  it('words the readable Supabase Auth errors instead of "Something went wrong"', () => {
    const auth = (code: string | undefined, message: string) => friendlyError(Object.assign(new Error(message), { name: 'AuthApiError', code }));
    const cases: [string | undefined, string, string][] = [
      ['signup_disabled', 'Signups not allowed for this instance', "New accounts can't be created right now. Try again later."],
      [undefined, 'Signups not allowed for this instance', "New accounts can't be created right now. Try again later."],
      ['same_password', 'New password should be different from the old password.', 'Choose a password different from your current one.'],
      [undefined, 'New password should be different from the old password.', 'Choose a password different from your current one.'],
      ['otp_expired', 'Email link is invalid or has expired', 'That link has expired or was already used. Ask for a new one.'],
      [undefined, 'Token has expired or is invalid', 'That link has expired or was already used. Ask for a new one.'],
      ['user_banned', 'User is banned', "This account can't sign in right now. Contact LA28 support."],
      ['over_email_send_rate_limit', 'Email rate limit exceeded', 'Too many tries. Wait a minute and try again.'],
      ['weak_password', 'Password should be at least 6 characters.', 'That password is too easy to guess. Try a longer one.'],
      ['email_not_confirmed', 'Email not confirmed', 'Confirm your email first. Check your inbox for the link.'],
      ['session_not_found', 'Session from session_id claim in JWT does not exist', 'Your session expired. Please sign in again.'],
    ];
    for (const [code, message, expected] of cases) expect({ code, message, text: auth(code, message) }).toEqual({ code, message, text: expected });
  });

  it('decodes picker base64 into the bytes that get uploaded', () => {
    const buf = base64ToArrayBuffer('iVBORw0KGgo='); // PNG signature
    expect(Array.from(new Uint8Array(buf))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });

  it('length messages match the limit (40 is allowed)', () => {
    expect(validateDraft({ ...rosa, firstName: 'a'.repeat(40) }).firstName).toBeUndefined();
    expect(validateDraft({ ...rosa, firstName: 'a'.repeat(41) }).firstName).toBe('Use 40 characters or fewer.');
  });
});

describe('what counts as a definite rejection', () => {
  const at = '2026-11-09T00:00:00.000Z';
  const existing = rowToProfile({ id: 'u1', verified: false, ...draftToWrite({ ...rosa, avatarPath: 'u1/avatar-old' }, at) });
  const photo = { uri: 'file:///n.jpg', mimeType: 'image/jpeg' };

  async function outcome(error: unknown) {
    const calls: string[] = [];
    const store: ProfileStore = {
      get: async () => null,
      save: async () => { throw error; },
      uploadAvatar: async () => 'u1/avatar-new',
      removeAvatar: async p => void calls.push(`remove ${p}`),
      avatarUrl: async p => p,
      deleteAll: async () => {},
      setAppLanguage: async () => { throw new Error('not used'); },
      saveSettings: async () => { throw new Error('not used'); },
    };
    const pending = { current: [] as PendingUpload[] };
    await expect(saveWithAvatar(store, 'u1', rosa, photo, existing, pending)).rejects.toBe(error);
    return calls.includes('remove u1/avatar-new') ? 'cleaned up' : pending.current.length ? 'kept for retry' : 'neither';
  }

  it('cleans up after a 4xx even without a PostgREST code (e.g. an HTML error page)', async () => {
    expect(await outcome({ code: '', message: '<html>Bad Request</html>', status: 400 })).toBe('cleaned up');
  });

  it('keeps the upload after a 5xx or a transport failure (the write may have happened)', async () => {
    expect(await outcome({ code: '', message: '<html>Bad Gateway</html>', status: 502 })).toBe('kept for retry');
    expect(await outcome({ code: '', message: 'TypeError: Failed to fetch', status: 0 })).toBe('kept for retry');
  });
});
