import type { SupabaseClient } from '@supabase/supabase-js';

import { PHOTO_MAX_BYTES, PHOTO_TOO_BIG, PHOTO_TYPES, PHOTO_WRONG_TYPE } from '@/constants/photo';
import { codedError } from '@/lib/errors';

import { draftToWrite, rowToProfile, settingsToWrite, type ProfileRow } from './mapping';
import { PRIVACY_VERSION } from './privacy';
import type { Profile, ProfileDraft, ProfileSettings } from './types';

export interface PickedImage {
  uri: string;
  mimeType: string | null;
  /** Bytes, when the picker knows it. */
  fileSize?: number | null;
  /** Present on web, where blob: URIs don't survive a reload. */
  base64?: string | null;
}

/**
 * A message to show by the photo, or null if the pick is fine. Uses the bucket's limits
 * (src/constants/photo.ts) so a bad pick fails here, not on upload. Unknown size/type passes.
 */
export function checkPhoto(image: Pick<PickedImage, 'mimeType' | 'fileSize'>): string | null {
  if (image.mimeType && !PHOTO_TYPES.includes(image.mimeType.toLowerCase())) return PHOTO_WRONG_TYPE;
  if (image.fileSize && image.fileSize > PHOTO_MAX_BYTES) return PHOTO_TOO_BIG;
  return null;
}

/**
 * The server definitely refused (so nothing was written): a PostgREST/our own error code, or an
 * HTTP 4xx. Transport failures come back as errors too, but with `code: ""` and status 0; a 5xx
 * is also ambiguous (the write may have happened), so neither counts.
 */
export function isServerRejection(e: unknown): boolean {
  const { code, status } = (e ?? {}) as { code?: unknown; status?: unknown };
  if (typeof code === 'string' && code.length > 0) return true;
  return typeof status === 'number' && status >= 400 && status < 500;
}

/** Persistence for the signed-in user's own profile. Swap implementations without touching screens. */
export interface ProfileStore {
  get(userId: string): Promise<Profile | null>;
  /**
   * Creates or updates. `existing` keeps the original consent time unless the policy version changed.
   * An update never writes the app language: the language pills own it (setAppLanguage), and a form
   * opened before a pill switch would otherwise put the old language back.
   */
  save(userId: string, draft: ProfileDraft, existing: Profile | null): Promise<Profile>;
  /**
   * Changes only the app language of an existing profile. Leaves privacy consent alone, so a pill
   * pick never records agreement to a newer policy, e.g. setAppLanguage('u1', 'ko').
   */
  setAppLanguage(userId: string, code: string): Promise<Profile>;
  /**
   * Changes only the given settings of an existing profile (the form never writes them), e.g.
   * saveSettings('u1', { availability: 'busy' }). Resolves with the profile as stored.
   */
  saveSettings(userId: string, settings: Partial<ProfileSettings>): Promise<Profile>;
  /** Stores the picked image and returns the value to keep in `avatarPath`. */
  uploadAvatar(userId: string, image: PickedImage): Promise<string>;
  removeAvatar(path: string): Promise<void>;
  /** A URL `expo-image` can show, or null. */
  avatarUrl(path: string): Promise<string | null>;
  /** Removes the profile row and photo. */
  deleteAll(userId: string): Promise<void>;
}

function consentTime(existing: Profile | null): string {
  return existing && existing.privacyVersion === PRIVACY_VERSION
    ? existing.privacyAcceptedAt
    : new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Local (device-only) store: used when Supabase isn't configured.

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const localKey = (userId: string) => `venu.profile.${userId}`;

/** Enough of a ProfileRow that the app can use it (role, name and languages are what screens rely on). */
function isProfileRowShape(v: unknown): v is ProfileRow {
  if (!v || typeof v !== 'object') return false;
  const r = v as Partial<ProfileRow>;
  return (
    (r.role === 'visitor' || r.role === 'volunteer') &&
    typeof r.first_name === 'string' &&
    typeof r.main_language === 'string' &&
    Array.isArray(r.languages) &&
    r.languages.includes(r.main_language)
  );
}

export function createLocalStore(storage: KeyValueStorage): ProfileStore {
  return {
    async get(userId) {
      const raw = await storage.getItem(localKey(userId));
      if (!raw) return null;
      let row: unknown = null;
      try {
        row = JSON.parse(raw);
      } catch {}
      if (isProfileRowShape(row)) return rowToProfile(row);
      // Unreadable or from an old format: drop it and start setup again rather than loading a
      // broken profile on every launch. Device-only dev data, so nothing the server holds is lost.
      await storage.removeItem(localKey(userId));
      return null;
    },
    async save(userId, draft, existing) {
      // The stored app language and settings, read now (not from `existing`, which a pill or settings
      // save may have outdated).
      let stored: ProfileRow | null = null;
      if (existing) {
        try {
          const parsed: unknown = JSON.parse((await storage.getItem(localKey(userId))) ?? 'null');
          if (isProfileRowShape(parsed)) stored = parsed;
        } catch {}
      }
      const row: ProfileRow = {
        id: userId,
        verified: existing?.verified ?? false,
        ...draftToWrite(draft, consentTime(existing)),
        // Role is fixed once the profile exists, same as the DB rule. The form never writes the settings.
        ...(existing
          ? {
              role: existing.role,
              app_language: stored?.app_language ?? existing.appLanguage,
              availability: stored?.availability ?? existing.availability,
              notification_prefs: stored?.notification_prefs ?? existing.notificationPrefs,
            }
          : {}),
      };
      try {
        await storage.setItem(localKey(userId), JSON.stringify(row));
      } catch (e) {
        // Web localStorage caps at ~5 MB; a base64 photo is the only thing big enough to hit it.
        if (row.avatar_path?.startsWith('data:')) throw codedError('photoTooBigLocal');
        throw e;
      }
      return rowToProfile(row);
    },
    async setAppLanguage(userId, code) {
      const raw = await storage.getItem(localKey(userId));
      let row: unknown = null;
      try {
        row = raw ? JSON.parse(raw) : null;
      } catch {}
      if (!isProfileRowShape(row)) throw new Error('No profile to update');
      const next: ProfileRow = { ...row, app_language: code };
      await storage.setItem(localKey(userId), JSON.stringify(next));
      return rowToProfile(next);
    },
    async saveSettings(userId, settings) {
      const raw = await storage.getItem(localKey(userId));
      let row: unknown = null;
      try {
        row = raw ? JSON.parse(raw) : null;
      } catch {}
      if (!isProfileRowShape(row)) throw new Error('No profile to update');
      const next: ProfileRow = { ...row, ...settingsToWrite(settings) };
      await storage.setItem(localKey(userId), JSON.stringify(next));
      return rowToProfile(next);
    },
    async uploadAvatar(_userId, image) {
      // Native keeps the picker's cache URI, which the OS may clear. Fine for this dev-only fallback.
      return image.base64 ? `data:${image.mimeType ?? 'image/jpeg'};base64,${image.base64}` : image.uri;
    },
    async removeAvatar() {},
    async avatarUrl(path) {
      return path;
    },
    async deleteAll(userId) {
      await storage.removeItem(localKey(userId));
    },
  };
}

// ---------------------------------------------------------------------------
// Supabase store: `public.profiles` + private `avatars` bucket.

/** Signed photo URLs last this long; the provider re-signs a bit before they expire. */
export const AVATAR_URL_TTL_S = 60 * 60;

export function createSupabaseStore(client: SupabaseClient, bucket: string): ProfileStore {
  const table = () => client.from('profiles');

  return {
    async get(userId) {
      const { data, error } = await table().select('*').eq('id', userId).maybeSingle<ProfileRow>();
      if (error) throw error;
      return data ? rowToProfile(data) : null;
    },
    async save(userId, draft, existing) {
      const write = draftToWrite(draft, consentTime(existing));
      // Role can't change after creation; the column isn't updatable for users. The app language is
      // left as stored: only setAppLanguage (the language pills) changes it.
      const { role: _role, app_language: _appLanguage, ...updatable } = write;
      const update = () => table().update(updatable).eq('id', userId).select('*').single<ProfileRow>();
      const insert = () => table().insert({ id: userId, ...write }).select('*').single<ProfileRow>();
      let result = existing ? await update() : await insert();

      if (!existing && result.error?.code === '23505') {
        // Row already exists (an earlier insert committed but its response was lost). Update it,
        // but only if it's the same role: role can't change, so never merge two roles' fields.
        const current = await table().select('role').eq('id', userId).single<{ role: ProfileRow['role'] }>();
        if (current.error) throw current.error;
        if (current.data.role !== write.role) {
          // A coded error counts as a definite rejection, so saveWithAvatar cleans up the new upload.
          throw codedError('roleMismatch', { role: current.data.role });
        }
        result = await update();
      } else if (existing && result.error?.code === 'PGRST116') {
        // No row to update (deleted on another device): create it again.
        result = await insert();
      }
      // Keep the HTTP status: a 4xx is a definite "no" even when the body has no PostgREST code.
      if (result.error) throw Object.assign(result.error, { status: result.status });
      return rowToProfile(result.data);
    },
    async setAppLanguage(userId, code) {
      const { data, error, status } = await table().update({ app_language: code }).eq('id', userId).select('*').single<ProfileRow>();
      if (error) throw Object.assign(error, { status });
      return rowToProfile(data);
    },
    async saveSettings(userId, settings) {
      const { data, error, status } = await table().update(settingsToWrite(settings)).eq('id', userId).select('*').single<ProfileRow>();
      if (error) throw Object.assign(error, { status });
      return rowToProfile(data);
    },
    async uploadAvatar(userId, image) {
      const contentType = image.mimeType ?? 'image/jpeg';
      // A fresh name per upload (`<uid>/avatar-<ms>`), so the live photo is never overwritten
      // before the row points at the new one; the provider deletes the old file after saving.
      const path = `${userId}/avatar-${Date.now()}`;
      // Prefer the picker's base64 (requested on native): fetch() on a local file:// URI isn't
      // reliable in React Native. Web blob: URIs fetch fine.
      let body: ArrayBuffer;
      try {
        body = image.base64 ? base64ToArrayBuffer(image.base64) : await (await fetch(image.uri)).arrayBuffer();
      } catch {
        // A local file, so not a network problem: e.g. a web blob: URL that died with a reload.
        throw codedError('photoUnreadable');
      }
      // No upsert: paths are never reused, so storage never needs to overwrite (and no UPDATE policy).
      const { error } = await client.storage.from(bucket).upload(path, body, { contentType });
      if (error) throw error;
      return path;
    },
    async removeAvatar(path) {
      const { error } = await client.storage.from(bucket).remove([path]);
      if (error) throw error;
    },
    async avatarUrl(path) {
      const { data, error } = await client.storage.from(bucket).createSignedUrl(path, AVATAR_URL_TTL_S);
      return error ? null : data.signedUrl;
    },
    async deleteAll(userId) {
      // Photos first, row last. If anything fails the profile still exists, so the app keeps
      // showing it (correctly), reports the failure, and a retry finishes the job. A row whose
      // photo is already gone just shows initials (avatarUrl() returns null for a missing file).
      // Row-first would instead leave the app showing a profile that no longer exists.
      // list() returns one page (100 by default), so page through everything in the folder.
      const PAGE = 100;
      const names: string[] = [];
      for (let offset = 0; ; offset += PAGE) {
        const listed = await client.storage.from(bucket).list(userId, { limit: PAGE, offset });
        if (listed.error) throw listed.error;
        names.push(...listed.data.map(f => `${userId}/${f.name}`));
        if (listed.data.length < PAGE) break;
      }
      if (names.length) {
        const removed = await client.storage.from(bucket).remove(names);
        if (removed.error) throw removed.error;
      }
      const { error } = await table().delete().eq('id', userId);
      if (error) throw error;
    },
  };
}

/**
 * Saves `userId`'s app language, then checks that they're still the one signed in. null means
 * another account signed in while it saved, so the caller mustn't treat it as done for the current
 * account (e.g. LanguageSync keeps the pick and decides again for the new account).
 */
export async function setAppLanguageIfCurrent(store: ProfileStore, userId: string, code: string, current: () => string | null): Promise<Profile | null> {
  const saved = await store.setAppLanguage(userId, code);
  return current() === userId ? saved : null;
}

/** `PickedImage` replaces the photo, `'remove'` clears it, `null` leaves it as is. */
export type AvatarChange = PickedImage | 'remove' | null;

/** An upload kept after a save failed on the network, so a retry reuses it instead of uploading again. */
export interface PendingUpload {
  uri: string;
  path: string;
}

/**
 * Saves a profile and its photo change in a safe order: upload the new photo to a fresh
 * path, save the row, and only then delete the old file. A failed save leaves the old
 * photo and row untouched.
 *
 * `pending` carries uploads across retries. After a network failure an upload is kept (the
 * row may already point at it), and a retry with the same picked image reuses it. Once a save
 * succeeds, every kept upload the row doesn't use is deleted. Only an upload made in this very
 * call is deleted on a server rejection: a reused one may be what an earlier, lost save committed.
 */
export async function saveWithAvatar(
  store: ProfileStore,
  userId: string,
  draft: ProfileDraft,
  avatar: AvatarChange,
  existing: Profile | null,
  pending: { current: PendingUpload[] } = { current: [] },
): Promise<Profile> {
  const previous = existing?.avatarPath ?? null;
  const picked = avatar && avatar !== 'remove' ? avatar : null;
  const reused = picked ? pending.current.find(u => u.uri === picked.uri) : undefined;
  const fresh = picked && !reused ? await store.uploadAvatar(userId, picked) : null;
  const avatarPath = avatar === 'remove' ? null : (reused?.path ?? fresh ?? previous);
  let saved: Profile;
  try {
    saved = await store.save(userId, { ...draft, avatarPath }, existing);
  } catch (e) {
    if (picked && fresh) {
      if (isServerRejection(e)) await store.removeAvatar(fresh).catch(() => {});
      else pending.current = [...pending.current, { uri: picked.uri, path: fresh }];
    }
    throw e;
  }
  const leftovers = pending.current.map(u => u.path).filter(p => p !== saved.avatarPath);
  pending.current = [];
  // Best effort cleanups; anything missed is an orphan in the user's own folder, and deleteAll sweeps it.
  for (const p of leftovers) await store.removeAvatar(p).catch(() => {});
  if (previous && previous !== saved.avatarPath && !leftovers.includes(previous)) {
    await store.removeAvatar(previous).catch(() => {});
  }
  return saved;
}

/** Decodes base64 (as expo-image-picker returns it) without a dependency; atob is built into Hermes and browsers. */
export function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
