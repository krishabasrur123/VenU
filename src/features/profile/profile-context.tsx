import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { deleteAccount, forgetDeletedAccount } from '@/lib/account';
import * as auth from '@/lib/auth';
import { onBeforeSignOut } from '@/lib/before-sign-out';
import { AVATAR_BUCKET, supabase } from '@/lib/supabase';

import { carryOverDeviceSettings } from './device-settings';
import { createSettingsSync } from './settings-sync';
import {
  AVATAR_URL_TTL_S,
  createLocalStore,
  createSupabaseStore,
  saveWithAvatar,
  setAppLanguageIfCurrent,
  type AvatarChange,
  type PendingUpload,
  type ProfileStore,
} from './store';
import type { Profile, ProfileDraft, ProfileSettings } from './types';

const store: ProfileStore = supabase
  ? createSupabaseStore(supabase, AVATAR_BUCKET)
  : createLocalStore(AsyncStorage);

// Settings saved on their own (one app, one provider, like `store`). The provider plugs in what a
// landed or refused save does to the screen.
const syncHandlers: { saved(p: Profile): void; rejected(): void } = { saved: () => {}, rejected: () => {} };
const sync = createSettingsSync({
  save: (uid, settings) => store.saveSettings(uid, settings),
  onSaved: p => syncHandlers.saved(p),
  onRejected: () => syncHandlers.rejected(),
});

/** `error`: couldn't load (e.g. offline); the saved session is kept and `refresh()` retries. */
type Status = 'loading' | 'signedOut' | 'ready' | 'error';

export type { AvatarChange };

interface ProfileContextValue {
  status: Status;
  /** Why loading failed (set while status is 'error'). The error itself: screens word it at render (errorText). */
  loadError: unknown;
  userId: string | null;
  profile: Profile | null;
  avatarUrl: string | null;
  /** Re-reads the session and profile; returns the profile (null if none yet). */
  refresh(): Promise<Profile | null>;
  save(draft: ProfileDraft, avatar: AvatarChange): Promise<Profile>;
  /**
   * Saves only the app language (the language pills); consent and the rest of the profile stay as
   * they are. Resolves null when another account signed in while it saved (that session wins).
   */
  saveAppLanguage(code: string): Promise<Profile | null>;
  /**
   * Changes settings that save on their own (Free / Busy / Off, notification switches): shows at once,
   * saves in the background and retries offline (settings-sync.ts), e.g. saveSettings({ availability: 'busy' }).
   */
  saveSettings(settings: Partial<ProfileSettings>): void;
  /**
   * Re-reads the profile without a loading or error screen, e.g. to see `verified` once LA28 sets it.
   * Keeps the photo URL when the photo hasn't changed.
   */
  recheck(): Promise<void>;
  /**
   * Deletes the account: its sign-in, profile and photos (the delete-account Edge Function), then
   * forgets it on this device (one step, so no screen sees "signed in, no profile"). Resolves
   * 'account', or 'dataOnly' when the function isn't deployed yet: the profile and photos are gone
   * but the sign-in remains, and the screen says so.
   */
  deleteAll(): Promise<'account' | 'dataOnly'>;
  signOut(): Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

interface Session {
  userId: string | null;
  profile: Profile | null;
  avatarUrl: string | null;
}

const SIGNED_OUT: Session = { userId: null, profile: null, avatarUrl: null };

/** The one place a stored photo path becomes a displayable URL. */
function urlFor(p: Profile | null): Promise<string | null> {
  return p?.avatarPath ? store.avatarUrl(p.avatarPath) : Promise.resolve(null);
}

async function loadSession(): Promise<Session> {
  const userId = await auth.currentUserId();
  const profile = userId ? await store.get(userId) : null;
  return { userId, profile, avatarUrl: await urlFor(profile) };
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [loadError, setLoadError] = useState<unknown>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Uploads kept after network-failed saves, reused by the next retry (see saveWithAvatar).
  const pendingUploads = useRef<PendingUpload[]>([]);
  // Last applied user, read by the auth listener (a ref, so the listener needn't resubscribe).
  const userIdRef = useRef<string | null>(null);
  // When the current photo URL was signed, so a foreground resume only re-signs near expiry.
  const signedAt = useRef(0);
  // Bumped by every load and every sign-out, so a slow load that finishes after something newer
  // happened (a sign-out, a sign-in, another load) is discarded instead of overwriting it.
  const generation = useRef(0);
  // The photo path on screen, for recheck() to tell whether the URL needs signing again.
  const avatarPathRef = useRef<string | null>(null);

  const setSignedUrl = useCallback((url: string | null) => {
    signedAt.current = url ? Date.now() : 0;
    setAvatarUrl(url);
  }, []);

  /** The single place the session changes, including every way of becoming signed out. */
  const applySession = useCallback(
    (s: Session) => {
      // Kept uploads belong to one account; never carry them into another session.
      if (s.userId !== userIdRef.current) pendingUploads.current = [];
      userIdRef.current = s.userId;
      // Another account (or signed out) drops unsaved settings; the same account keeps them on top.
      sync.setUser(s.userId);
      avatarPathRef.current = s.profile?.avatarPath ?? null;
      setUserId(s.userId);
      setProfile(sync.overlay(s.profile));
      setSignedUrl(s.avatarUrl);
      setStatus(s.userId ? 'ready' : 'signedOut');
      setLoadError(null);
    },
    [setSignedUrl],
  );

  const goSignedOut = useCallback(() => {
    generation.current += 1; // drop any load still in flight
    applySession(SIGNED_OUT);
  }, [applySession]);

  const saveSettings = useCallback(
    (settings: Partial<ProfileSettings>) => {
      const uid = userIdRef.current;
      if (!uid) return;
      setProfile(p => (p && p.id === uid ? { ...p, ...settings } : p));
      sync.change(settings);
    },
    [],
  );

  /**
   * Loads the session and applies it, unless something newer happened meanwhile.
   * `quiet` (background reloads: another tab, after a failed delete) keeps the current screen
   * on failure; otherwise a failure shows the "Can't reach VenU" / load-error screen.
   */
  const load = useCallback(
    async (quiet: boolean): Promise<Profile | null> => {
      const mine = ++generation.current;
      try {
        const s = await loadSession();
        if (mine === generation.current) {
          applySession(s);
          // Settings saved on this device before they moved to the profile come along once
          // (compared with what's on screen, so an unsaved change here wins).
          const loaded = sync.overlay(s.profile);
          if (loaded) {
            void carryOverDeviceSettings(loaded, {
              storage: AsyncStorage,
              save: saveSettings,
              idle: () => sync.idle(),
              pending: () => sync.pending(),
              isCurrent: () => userIdRef.current === loaded.id,
            });
          }
        }
        return s.profile;
      } catch (e) {
        if (!quiet && mine === generation.current) {
          setLoadError(e);
          setStatus('error');
        }
        throw e;
      }
    },
    [applySession, saveSettings],
  );

  const refresh = useCallback(() => load(false), [load]);

  // A settings save that lands updates only the settings on screen, so it can't undo a profile form
  // save or photo change made meanwhile. One the server refused: show what's stored.
  useEffect(() => {
    syncHandlers.saved = saved =>
      setProfile(p => (p && p.id === saved.id ? { ...p, availability: saved.availability, notificationPrefs: saved.notificationPrefs } : p));
    syncHandlers.rejected = () => void load(true).catch(() => {});
  }, [load]);

  // Startup load. A failure (e.g. offline) is 'error', not 'signedOut', so a saved session isn't thrown away.
  useEffect(() => {
    load(false).catch(() => {});
  }, [load]);

  // Session changed elsewhere: signed out (token revoked/expired, another tab) → drop to signed out;
  // someone signed in (another tab, whether this one was signed out or showing a different user)
  // → reload quietly, so we never show A's data under B's session or sit on sign-in with a live
  // session, and a blip doesn't throw this tab onto the error screen.
  // INITIAL_SESSION is skipped: the startup load above already covers it.
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return;
      if (event === 'SIGNED_OUT') {
        goSignedOut();
      } else if (session && session.user.id !== userIdRef.current) {
        // Supabase warns against awaiting its own calls inside this callback; defer.
        setTimeout(() => load(true).catch(() => {}), 0);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [goSignedOut, load]);

  // Signed photo URLs expire. Re-sign shortly before they do while the app stays open, and on
  // returning to the foreground (JS timers don't run while a phone app is backgrounded), but only
  // when the URL is near expiry: a new URL makes the image re-download. If there's no URL yet
  // (signing failed, e.g. a blip right after saving), retry soon instead of waiting an hour.
  const avatarPath = profile?.avatarPath ?? null;
  useEffect(() => {
    if (!supabase || !avatarPath) return;
    const refreshAfterMs = (AVATAR_URL_TTL_S - 5 * 60) * 1000;
    // `alive` drops a re-sign that finishes after the photo changed, so it can't overwrite the new URL.
    let alive = true;
    const resign = () => {
      store.avatarUrl(avatarPath).then(url => alive && url && setSignedUrl(url)).catch(() => {});
    };
    const timer = setInterval(resign, refreshAfterMs);
    const retries = signedAt.current === 0 ? [5_000, 30_000, 120_000].map(ms => setTimeout(() => signedAt.current === 0 && resign(), ms)) : [];
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && Date.now() - signedAt.current > refreshAfterMs) resign();
    });
    return () => {
      alive = false;
      clearInterval(timer);
      retries.forEach(clearTimeout);
      sub.remove();
    };
  }, [avatarPath, setSignedUrl]);

  const save = useCallback(
    async (draft: ProfileDraft, avatar: AvatarChange) => {
      if (!userId) throw new Error('Not signed in');
      const saved = await saveWithAvatar(store, userId, draft, avatar, profile, pendingUploads);
      // Someone else signed in (another tab) while this saved: that session wins; don't show A's
      // saved profile under B's session.
      if (userIdRef.current !== userId) return saved;
      generation.current += 1; // a same-user reload that started before this save mustn't put the old profile back
      // Same photo: keep the current URL (no extra round trip, no re-download).
      if (saved.avatarPath !== (profile?.avatarPath ?? null)) setSignedUrl(await urlFor(saved));
      avatarPathRef.current = saved.avatarPath;
      setProfile(sync.overlay(saved));
      return saved;
    },
    [userId, profile, setSignedUrl],
  );

  const saveAppLanguage = useCallback(
    async (code: string) => {
      if (!userId) throw new Error('Not signed in');
      const saved = await setAppLanguageIfCurrent(store, userId, code, () => userIdRef.current);
      if (!saved) return null;
      generation.current += 1;
      setProfile(sync.overlay(saved));
      return saved;
    },
    [userId],
  );

  const recheck = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;
    const mine = generation.current;
    const fresh = await store.get(uid);
    // Something newer happened (a load, a save, a sign-out): that wins.
    if (!fresh || mine !== generation.current || userIdRef.current !== uid) return;
    if (fresh.avatarPath !== avatarPathRef.current) {
      const url = await urlFor(fresh);
      if (mine !== generation.current || userIdRef.current !== uid) return;
      setSignedUrl(url);
    }
    avatarPathRef.current = fresh.avatarPath;
    // Settings stay as shown: a settings save may have landed while this read was out.
    setProfile(p => (p && p.id === uid ? { ...fresh, availability: p.availability, notificationPrefs: p.notificationPrefs } : p));
  }, [setSignedUrl]);

  // An offline settings save tries again on returning to the app, and gets a last go before sign-out
  // (while the session still allows it; sign-out waits a few seconds at most).
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') void sync.retry();
    });
    const off = onBeforeSignOut(() => sync.idle());
    return () => {
      sub.remove();
      off();
    };
  }, []);

  const deleteAll = useCallback(async (): Promise<'account' | 'dataOnly'> => {
    if (!userId) return 'account';
    // Any kept upload is in the folder this sweeps, so it can't be reused afterwards either way.
    pendingUploads.current = [];
    let outcome: Awaited<ReturnType<typeof deleteAccount>>;
    try {
      outcome = await deleteAccount();
      // Not deployed yet (or local mode): delete what the app can reach itself.
      if (outcome !== 'deleted') await store.deleteAll(userId);
    } catch (e) {
      // Part of it may be gone (e.g. the photo). Show what's actually there now, quietly, so the
      // Profile screen stays up to report the failure even if this reload fails too.
      await load(true).catch(() => {});
      throw e;
    }
    // The data is gone; a sign-out hiccup mustn't leave a signed-in user with no profile. A deleted
    // account's server session went with it, so only this device's copy is dropped.
    if (outcome === 'deleted') await forgetDeletedAccount();
    else await auth.signOut().catch(() => {});
    goSignedOut();
    return outcome === 'notDeployed' ? 'dataOnly' : 'account';
  }, [userId, load, goSignedOut]);

  const signOut = useCallback(async () => {
    await auth.signOut();
    goSignedOut();
  }, [goSignedOut]);

  const value = useMemo(
    () => ({ status, loadError, userId, profile, avatarUrl, refresh, save, saveAppLanguage, saveSettings, recheck, deleteAll, signOut }),
    [status, loadError, userId, profile, avatarUrl, refresh, save, saveAppLanguage, saveSettings, recheck, deleteAll, signOut],
  );
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used inside <ProfileProvider>');
  return ctx;
}
