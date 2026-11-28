// Saves profile settings (Free / Busy / Off, notification switches) as they're flipped, without
// making the screen wait: the change shows at once, goes to the profile in the background, and an
// offline save is retried (after 2 s, then twice as long each time up to 30 s, on app resume, or with
// the next change) until it lands or the account changes. A reload while a change is still unsaved
// keeps showing the change (overlay), so it never flips back.
// e.g. change({ availability: 'busy' }) offline → Busy shows; back online → saved, pending() is {}.
//
// One per app, owned by the profile provider (profile-context.tsx). Pure, so it's tested on its own.

import { isServerRejection } from './store';
import type { Profile, ProfileSettings } from './types';

export const SETTINGS_RETRY_MS = 2000;
export const SETTINGS_RETRY_MAX_MS = 30_000;

export interface SettingsSyncOptions {
  /** Writes the settings to the user's profile and resolves with the stored profile. */
  save(userId: string, settings: Partial<ProfileSettings>): Promise<Profile>;
  /** A save landed for the current account: the stored profile with any newer unsaved change laid over it. */
  onSaved(profile: Profile): void;
  /** The server refused the change outright (e.g. a value it doesn't take); it's dropped, not retried. */
  onRejected?(error: unknown): void;
  retryMs?: number;
  maxRetryMs?: number;
}

export function createSettingsSync({ save, onSaved, onRejected, retryMs = SETTINGS_RETRY_MS, maxRetryMs = SETTINGS_RETRY_MAX_MS }: SettingsSyncOptions) {
  let owner: string | null = null;
  let pending: Partial<ProfileSettings> = {};
  /** Bumped on every account change, so a save for the previous account never lands. */
  let generation = 0;
  let inFlight: Promise<void> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let wait = retryMs;

  const isEmpty = () => Object.keys(pending).length === 0;

  function clearTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  /** Forgets what was sent, unless it changed again meanwhile (a newer value still needs saving). */
  function settle(sent: Partial<ProfileSettings>) {
    const next = { ...pending };
    for (const key of Object.keys(sent) as (keyof ProfileSettings)[]) if (next[key] === sent[key]) delete next[key];
    pending = next;
  }

  function overlay(profile: Profile): Profile;
  function overlay(profile: Profile | null): Profile | null;
  function overlay(profile: Profile | null): Profile | null {
    return profile && profile.id === owner && !isEmpty() ? { ...profile, ...pending } : profile;
  }

  function flush(): Promise<void> {
    if (inFlight) return inFlight;
    clearTimer();
    if (!owner || isEmpty()) return Promise.resolve();
    const user = owner;
    const mine = generation;
    const sent = { ...pending };
    let again = false;
    const run = (async () => {
      try {
        const saved = await save(user, sent);
        if (mine !== generation) return;
        settle(sent);
        wait = retryMs;
        again = true;
        onSaved(overlay(saved));
      } catch (e) {
        if (mine !== generation) return;
        if (isServerRejection(e)) {
          settle(sent);
          again = true;
          onRejected?.(e);
          return;
        }
        // Offline (or a 5xx): try again later, backing off.
        timer = setTimeout(() => {
          timer = null;
          void flush();
        }, wait);
        wait = Math.min(wait * 2, maxRetryMs);
      }
    })();
    inFlight = run.finally(() => {
      if (mine !== generation) return;
      inFlight = null;
      // A change made while this one was saving gets its turn now.
      if (again && !isEmpty()) void flush();
    });
    return inFlight;
  }

  return {
    /** The account whose settings this saves; another account (or null, signed out) drops anything unsaved. */
    setUser(userId: string | null) {
      if (userId === owner) return;
      generation += 1;
      owner = userId;
      pending = {};
      inFlight = null;
      clearTimer();
      wait = retryMs;
    },
    /** Queues a change for the current account and starts saving it. Show it on screen yourself (or via overlay). */
    change(settings: Partial<ProfileSettings>) {
      if (!owner) return;
      pending = { ...pending, ...settings };
      // A newer change doesn't wait out the backoff.
      if (!inFlight) void flush();
    },
    /** `profile` with the current account's unsaved changes on top (unchanged for anyone else). */
    overlay,
    /** Tries an unsaved change again now (app resume). */
    retry(): Promise<void> {
      return flush();
    },
    /** Resolves once nothing is being saved (e.g. before signing out); an offline save stays queued. */
    async idle(): Promise<void> {
      if (!inFlight && !isEmpty()) await flush();
      while (inFlight) await inFlight;
    },
    /** What hasn't been saved yet. */
    pending(): Partial<ProfileSettings> {
      return pending;
    },
  };
}

export type SettingsSync = ReturnType<typeof createSettingsSync>;
