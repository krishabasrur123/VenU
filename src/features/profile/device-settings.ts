// Settings this device kept before they moved to the profile: Free / Busy / Off per user
// ('venu.availability.<uid>' → 'off') and the notification switches for whoever used the device
// ('venu.notifications' → '{"venue":false,...}'). Carried over once, so a volunteer who was Off
// doesn't come back Free with every alert on: a value moves to the profile only while the profile
// still has the default, and the old keys are removed once that save lands (or the profile already
// has its own value). Offline, the keys stay and the next start tries again.

import { DEFAULT_PREFS, parseNotificationPrefs } from '@/features/settings/notification-prefs';
import { DEFAULT_AVAILABILITY, parseAvailability } from '@/features/volunteer/availability';

import type { KeyValueStorage } from './store';
import type { Profile, ProfileSettings } from './types';

export const DEVICE_NOTIFICATIONS_KEY = 'venu.notifications';

export function deviceAvailabilityKey(userId: string): string {
  return `venu.availability.${userId}`;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const samePrefs = (a: ProfileSettings['notificationPrefs'], b: ProfileSettings['notificationPrefs']) =>
  (Object.keys(DEFAULT_PREFS) as (keyof typeof DEFAULT_PREFS)[]).every(k => a[k] === b[k]);

/**
 * The old device values the profile should take over, and the old keys found.
 * e.g. profile Free + 'venu.availability.u1' = 'off' → { carry: { availability: 'off' }, keys: ['venu.availability.u1'] }
 */
export async function readDeviceSettings(storage: KeyValueStorage, profile: Profile): Promise<{ carry: Partial<ProfileSettings>; keys: string[] }> {
  const carry: Partial<ProfileSettings> = {};
  const keys: string[] = [];
  const availabilityKey = deviceAvailabilityKey(profile.id);
  const [availabilityRaw, prefsRaw] = await Promise.all([storage.getItem(availabilityKey), storage.getItem(DEVICE_NOTIFICATIONS_KEY)]);
  if (availabilityRaw !== null) {
    keys.push(availabilityKey);
    const old = parseAvailability(availabilityRaw);
    if (old && old !== profile.availability && profile.availability === DEFAULT_AVAILABILITY) carry.availability = old;
  }
  if (prefsRaw !== null) {
    keys.push(DEVICE_NOTIFICATIONS_KEY);
    const old = parseNotificationPrefs(parseJson(prefsRaw));
    if (!samePrefs(old, profile.notificationPrefs) && samePrefs(profile.notificationPrefs, DEFAULT_PREFS)) carry.notificationPrefs = old;
  }
  return { carry, keys };
}

export interface CarryOverDeps {
  storage: KeyValueStorage;
  /** Shows the settings and queues their save (the profile provider's saveSettings). */
  save(settings: Partial<ProfileSettings>): void;
  /** Resolves once nothing is being saved (settings-sync idle()). */
  idle(): Promise<void>;
  /** What hasn't been saved yet (settings-sync pending()). */
  pending(): Partial<ProfileSettings>;
  /** False once another account signed in (or out) meanwhile. */
  isCurrent(): boolean;
}

/** Moves old device settings onto `profile` (see the top of this file). Never throws. */
export async function carryOverDeviceSettings(profile: Profile, deps: CarryOverDeps): Promise<void> {
  try {
    const { carry, keys } = await readDeviceSettings(deps.storage, profile);
    if (!keys.length || !deps.isCurrent()) return;
    const fields = Object.keys(carry) as (keyof ProfileSettings)[];
    if (fields.length) {
      deps.save(carry);
      await deps.idle();
      const pending = deps.pending();
      // Still unsaved (offline), or the account changed: keep the keys for the next start.
      if (!deps.isCurrent() || fields.some(f => f in pending)) return;
    }
    await Promise.all(keys.map(k => deps.storage.removeItem(k)));
  } catch {
    // Storage blocked: nothing to carry over.
  }
}
