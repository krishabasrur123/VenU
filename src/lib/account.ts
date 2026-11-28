// Account actions beyond signing in and out (those are in auth.ts): password reset, social sign-in
// and deleting the account with its sign-in.
//   requestPasswordReset('rosa_m')          → password-reset Edge Function emails rosa's link
//   requestPasswordReset('rosa@example.com') → supabase.auth.resetPasswordForEmail
//   setPasswordFromLink(tokens, 'new-pw')    → the link's session sets it, then every session ends
//   signInWithProvider('google')             → web: off to Google and back to /auth-callback
//   deleteAccount()                          → delete-account Edge Function (photos, then the auth user)

import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { firstNameFromMetadata, parseAuthRedirect, providerName, type OAuthProvider } from '@/features/auth/auth-redirect';
import { clearPendingName, rememberPendingName } from '@/features/auth/pending-setup';
import { isEmailLike, normalizeUsername } from '@/features/auth/username';
import { clearSavedDraft } from '@/features/profile/setup-draft-storage';
import i18n from '@/i18n';
import { signIn } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { createDetachedClient, supabase, supabaseConfig } from '@/lib/supabase';

export type ActionResult = { ok: true } | { ok: false; error: string };
/** `leaving`: the page is off to the provider (web). `cancelled`: closed without signing in (phone); nothing to show. */
export type SocialResult = { ok: true; leaving?: boolean } | { ok: false; error: string } | { ok: false; cancelled: true };

/** Where Auth sends someone back to: this site on web, the app's scheme on a phone (venu://reset-password). */
export function authRedirectUrl(path: '/reset-password' | '/auth-callback'): string {
  if (Platform.OS === 'web') return typeof window === 'undefined' ? path : `${window.location.origin}${path}`;
  return Linking.createURL(path.slice(1));
}

/** Why a function call failed, in a shape friendlyError understands (the reply body, or the network error). */
async function failureOf(error: unknown, response: Response | undefined): Promise<unknown> {
  return response ? await response.json().catch(() => null) : (error as { context?: unknown }).context ?? error;
}

// ---------------------------------------------------------------------------
// Password reset

/**
 * Emails a reset link. The answer never says whether the account exists: the screen shows the same
 * "If an account exists…" either way. A username goes to the password-reset Edge Function, which
 * looks its email up server-side; until that's deployed, the user is asked for the email instead.
 */
export async function requestPasswordReset(identifier: string): Promise<ActionResult> {
  if (!supabase) return { ok: true };
  const typed = identifier.trim();
  const redirectTo = authRedirectUrl('/reset-password');
  if (isEmailLike(typed)) {
    const { error } = await supabase.auth.resetPasswordForEmail(typed, { redirectTo });
    return error ? { ok: false, error: friendlyError(error) } : { ok: true };
  }
  const { error, response } = await supabase.functions.invoke('password-reset', { body: { username: normalizeUsername(typed), redirectTo } });
  if (!error) return { ok: true };
  if (response?.status === 404) return { ok: false, error: i18n.t('onboarding:forgot.useEmail') };
  return { ok: false, error: friendlyError(await failureOf(error, response)) };
}

/**
 * Sets a new password with the session from a reset link, on a client of its own so this device
 * doesn't end up signed in, then signs out everywhere: whoever had the old password loses access.
 */
export async function setPasswordFromLink(tokens: { accessToken: string; refreshToken: string }, password: string): Promise<ActionResult> {
  const client = createDetachedClient();
  if (!client) return { ok: true };
  const set = await client.auth.setSession({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken });
  if (set.error) return { ok: false, error: friendlyError(set.error) };
  const { error } = await client.auth.updateUser({ password });
  if (error) return { ok: false, error: friendlyError(error) };
  await client.auth.signOut().catch(() => {});
  // Signed in to that same account here too: that session was just revoked, so drop it now rather
  // than at its next refresh.
  const mine = await supabase?.auth.getSession().catch(() => null);
  if (mine?.data.session && mine.data.session.user.id === set.data.user?.id) await supabase?.auth.signOut({ scope: 'local' }).catch(() => {});
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Social sign-in

/** Whether the provider is switched on in Supabase (Authentication > Sign In / Providers). */
async function providerEnabled(provider: OAuthProvider): Promise<boolean> {
  if (!supabaseConfig) return false;
  const res = await fetch(`${supabaseConfig.url}/auth/v1/settings`, { headers: { apikey: supabaseConfig.anonKey } });
  const settings = (await res.json().catch(() => null)) as { external?: Record<string, unknown> } | null;
  return settings?.external?.[provider] === true;
}

const notEnabled = (provider: OAuthProvider) => ({ ok: false as const, error: i18n.t('onboarding:social.notEnabled', { provider: providerName(provider) }) });

/**
 * Signs in with Facebook, Google or Apple. Checks first that the provider is on, so a project
 * without it shows a sentence instead of Supabase's raw error page.
 * - Web: the page leaves for the provider and comes back to /auth-callback, which finishes it
 *   (so a success resolves with `leaving: true` and nothing else to do).
 * - Phone: an in-app browser session (expo-web-browser), finished right here.
 * - Local mode (no backend): signs in like any email and password does there.
 */
export async function signInWithProvider(provider: OAuthProvider): Promise<SocialResult> {
  if (!supabase) {
    await signIn('', '');
    return { ok: true };
  }
  try {
    if (!(await providerEnabled(provider))) return notEnabled(provider);
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
  const redirectTo = authRedirectUrl('/auth-callback');
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
    return error ? { ok: false, error: friendlyError(error) } : { ok: true, leaving: true };
  }
  const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true } });
  if (error || !data.url) return { ok: false, error: friendlyError(error) };
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return { ok: false, cancelled: true };
  return completeOAuthRedirect(result.url);
}

/** The sentence for an error Auth put on the return URL. */
function oauthErrorText(code: string, description: string): string {
  if (code === 'access_denied' && !/expired|invalid/i.test(description)) return i18n.t('onboarding:social.cancelled');
  if (/not enabled|unsupported provider|provider is disabled/i.test(description)) return i18n.t('onboarding:social.notEnabledAny');
  const known = friendlyError({ code, message: description }, '');
  return known || i18n.t('onboarding:social.failed');
}

/**
 * Finishes a social sign-in from the URL Auth sent back (/auth-callback#access_token=…): stores the
 * session and keeps the provider's first name for setup (a new account has no profile yet, so the
 * app goes on to onboarding).
 */
export async function completeOAuthRedirect(url: string | null): Promise<ActionResult> {
  if (!supabase) return { ok: true };
  const back = parseAuthRedirect(url);
  if (back.kind === 'error') return { ok: false, error: oauthErrorText(back.code, back.description) };
  if (back.kind === 'none') return { ok: false, error: i18n.t('onboarding:social.failed') };
  const { data, error } = await supabase.auth.setSession({ access_token: back.accessToken, refresh_token: back.refreshToken });
  if (error || !data.user) return { ok: false, error: friendlyError(error) };
  const firstName = firstNameFromMetadata(data.user.user_metadata);
  await rememberPendingName(data.user.email ?? data.user.id, firstName);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Delete account

/**
 * - 'deleted': the account, its sign-in and photos are gone (the database drops the profile and
 *   username with it, see supabase/migrations/20261118030000_account_deletion.sql);
 * - 'notDeployed': the delete-account function isn't on the project yet, nothing was deleted;
 * - 'local': local mode, there is no server account.
 * Throws when the function refused or couldn't be reached.
 */
export async function deleteAccount(): Promise<'deleted' | 'notDeployed' | 'local'> {
  if (!supabase) return 'local';
  const { error, response } = await supabase.functions.invoke('delete-account', { body: {} });
  if (!error) return 'deleted';
  // The gateway's 404 for a function that isn't deployed; the function itself never answers 404.
  if (response?.status === 404) return 'notDeployed';
  if (response?.status === 401) throw Object.assign(new Error('not signed in'), { code: 'session_not_found' });
  throw await failureOf(error, response);
}

/**
 * After 'deleted': forget the account on this device. Its server session went with the user, so
 * this only drops the stored one (a global sign-out would be refused), plus the half-finished setup
 * answers and the name and role kept for setup. This device's language choice stays.
 */
export async function forgetDeletedAccount(): Promise<void> {
  await clearSavedDraft().catch(() => {});
  await clearPendingName();
  await supabase?.auth.signOut({ scope: 'local' }).catch(() => {});
}
