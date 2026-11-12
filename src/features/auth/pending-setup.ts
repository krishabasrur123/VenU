// What someone picks before they have a profile, kept on this device until profile setup uses it:
// the app language from the landing page's language pill, and the name typed on Create Account.
// e.g. { language: 'es', firstName: 'Rosa', email: 'rosa@example.com' } → setup opens with Español
// as primary and "Rosa" filled in, but only for rosa@example.com.
// Stored (not a route param) so it survives an email-confirmation round trip or a web reload.

import AsyncStorage from '@react-native-async-storage/async-storage';

import { isKnownLanguage } from '@/features/profile/options';

const KEY = 'venu.setup.pending';

export interface PendingSetup {
  language?: string;
  firstName?: string;
  /** The account `firstName` was typed for (trimmed, lower case). */
  email?: string;
}

export async function readPendingSetup(): Promise<PendingSetup> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as PendingSetup) : {};
    return {
      language: isKnownLanguage(v.language) ? v.language : undefined,
      firstName: typeof v.firstName === 'string' ? v.firstName : undefined,
      email: typeof v.email === 'string' ? v.email : undefined,
    };
  } catch {
    return {}; // a broken entry only loses a convenience
  }
}

/** Merges into what's stored: keys left out are kept, a key set to `undefined` is cleared. */
export async function writePendingSetup(patch: PendingSetup): Promise<void> {
  try {
    const next = { ...(await readPendingSetup()), ...patch };
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked (private browsing): setup just starts blank.
  }
}

const normalEmail = (email: string) => email.trim().toLowerCase();

/** Create Account: remember the name for this account (or forget an earlier one when it's blank). */
export async function rememberPendingName(email: string, name: string | undefined): Promise<void> {
  const firstName = name?.trim() || undefined;
  await writePendingSetup({ firstName, email: firstName ? normalEmail(email) : undefined });
}

/**
 * Sign In: keep the remembered name only if it was typed for this account, so someone else's
 * name from Create Account on this device never pre-fills a different account's setup.
 */
export async function forgetPendingNameUnlessFor(email: string): Promise<void> {
  const pending = await readPendingSetup();
  if (pending.firstName === undefined && pending.email === undefined) return;
  if (pending.email !== normalEmail(email)) await writePendingSetup({ firstName: undefined, email: undefined });
}

/** After setup saves: the name now lives in the profile. The language stays as this device's choice. */
export async function clearPendingName(): Promise<void> {
  const { language } = await readPendingSetup();
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ language }));
  } catch {}
}
