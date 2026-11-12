// Turns errors from fetch / Supabase into one plain sentence for the screen, in the UI language.
// e.g. TypeError("Failed to fetch") → "Can't reach VenU. Check your connection and try again."
//      (Spanish UI → "No se puede conectar con VenU. Revisa tu conexión e inténtalo de nuevo.")
// Strings: common:errors.* in src/i18n/locales.

import { PHOTO_MAX_BYTES } from '@/constants/photo';
import i18n from '@/i18n';

/**
 * The offline sentence in the current language. A live binding (updated on language change), so
 * `loadError === OFFLINE` keeps working for a message made in the same language.
 */
export let OFFLINE = i18n.t('errors.offline');
i18n.on('languageChanged', () => {
  OFFLINE = i18n.t('errors.offline');
});

const KNOWN: [RegExp, () => string][] = [
  [/failed to fetch|network request failed|networkerror|load failed|fetch failed/i, () => i18n.t('errors.offline')],
  [/invalid login credentials/i, () => i18n.t('errors.wrongLogin')],
  [/email not confirmed/i, () => i18n.t('errors.confirmEmail')],
  [/user already registered/i, () => i18n.t('errors.alreadyRegistered')],
  [/rate limit|too many requests/i, () => i18n.t('errors.rateLimit')],
  // Shown on screens with and without a sign-out button (e.g. sign-in), so no "sign out" step.
  [/jwt expired|invalid jwt|refresh token/i, () => i18n.t('errors.sessionExpired')],
  // Not a session problem: the database or storage policy refused this change.
  [/row-level security|permission denied/i, () => i18n.t('errors.cantSave')],
  [/exceeded the maximum allowed size|payload too large/i, () => i18n.t('errors.photoTooBig', { size: PHOTO_MAX_BYTES / 1024 / 1024 })],
  [/mime type/i, () => i18n.t('errors.photoWrongType')],
];

/** PostgREST errors have `details` and `hint`; Storage errors are named Storage*Error. */
function isDatabaseOrStorageError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const name = (e as { name?: unknown }).name;
  return ('details' in e && 'hint' in e) || (typeof name === 'string' && name.startsWith('Storage'));
}

export function friendlyError(e: unknown, fallback = i18n.t('errors.generic')): string {
  const message = e instanceof Error ? e.message : typeof e === 'string' ? e : (e as { message?: unknown })?.message;
  // Supabase marks network failures as AuthRetryableFetchError with status 0.
  if ((e as { name?: string })?.name === 'AuthRetryableFetchError') return i18n.t('errors.offline');
  if (typeof message !== 'string' || !message.trim()) return fallback;
  for (const [pattern, friendly] of KNOWN) if (pattern.test(message)) return friendly();
  // Unrecognised database/storage errors carry internals (constraint and table names): don't show them.
  if (isDatabaseOrStorageError(e)) return fallback;
  // Our own errors (and Supabase auth's) are written for people, so show them as they are.
  return message;
}
