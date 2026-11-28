import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js';

import { isEmailLike, normalizeUsername } from '@/features/auth/username';
import { clearSavedDraft } from '@/features/profile/setup-draft-storage';
import { runBeforeSignOut } from '@/lib/before-sign-out';
import { codedError, friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

export const LOCAL_USER_ID = 'local-guest';
const LOCAL_SESSION_KEY = 'venu.local.session';

/** `email`: the account's email once signed in (a username sign-in reads it from the new session). `field`: where to show the error. */
export type AuthResult =
  | { ok: true; needsConfirmation?: boolean; email?: string }
  | { ok: false; error: string; field?: 'username' };

export const isLocalMode = supabase === null;

/** No such username: worded exactly like a wrong password, so sign-in doesn't reveal which usernames exist. */
const wrongLogin = () => friendlyError({ code: 'invalid_credentials' });

/**
 * Sign in with a username or an email. A username goes to the `username-sign-in` Edge Function,
 * which looks the email up server-side and returns only a session, so the app never sees the email
 * of an account it can't sign in to. The account's email then comes from the signed-in user.
 * e.g. signIn('rosa_m', pw) → username-sign-in → { access_token, refresh_token } → setSession
 *      → { ok: true, email: 'rosa@example.com' }
 */
export async function signIn(identifier: string, password: string): Promise<AuthResult> {
  if (!supabase) {
    await AsyncStorage.setItem(LOCAL_SESSION_KEY, '1');
    return { ok: true };
  }
  const typed = identifier.trim();
  if (!isEmailLike(typed)) return signInByUsername(supabase, normalizeUsername(typed), password);
  return signInByEmail(supabase, typed, password);
}

async function checkEmailConfirmed(client: SupabaseClient): Promise<string | null> {
  const { data } = await client.auth.getUser();
  if (data.user?.email_confirmed_at) return null; // confirmed — no problem
  // Not confirmed: sign them back out so the session doesn't persist
  await client.auth.signOut({ scope: 'local' });
  return data.user?.email ?? null; // return email so the UI can pre-fill it
}

async function signInByEmail(client: SupabaseClient, email: string, password: string): Promise<AuthResult> {
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: friendlyError(error) };
  const unconfirmedEmail = await checkEmailConfirmed(client);
  if (unconfirmedEmail !== null) {
    return { ok: true, needsConfirmation: true, email: unconfirmedEmail };
  }
  return { ok: true, email };
}

interface FunctionSession {
  access_token?: unknown;
  refresh_token?: unknown;
}

async function signInByUsername(client: SupabaseClient, username: string, password: string): Promise<AuthResult> {
  const { data, error, response } = await client.functions.invoke<FunctionSession>('username-sign-in', { body: { username, password } });
  if (error) {
    // Not deployed yet (the gateway's 404; the function itself never answers 404): sign in the old
    // way until it is. Deploy the function before revoking email_for_username (see its migration).
    if (response?.status === 404) return signInByLookup(client, username, password);
    // The function answers like Auth ({ code: 'invalid_credentials', … }); a network failure has
    // no response, and its cause (e.g. "Failed to fetch") says so.
    const reason = response ? await response.json().catch(() => null) : (error as { context?: unknown }).context ?? error;
    return { ok: false, error: friendlyError(reason) };
  }
  if (typeof data?.access_token !== 'string' || typeof data.refresh_token !== 'string') return { ok: false, error: friendlyError(null) };
  const set = await client.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
  if (set.error) return { ok: false, error: friendlyError(set.error) };
  const unconfirmedEmail = await checkEmailConfirmed(client);
  if (unconfirmedEmail !== null) {
    return { ok: true, needsConfirmation: true, email: unconfirmedEmail };
  }
  return { ok: true, email: set.data.user?.email ?? undefined };
}

/**
 * Before the function is deployed: the email from `email_for_username` (granted to anon until
 * supabase/migrations/20261117000000_private_username_lookup.sql), then a password sign-in.
 */
async function signInByLookup(client: SupabaseClient, username: string, password: string): Promise<AuthResult> {
  const { data, error } = await client.rpc('email_for_username', { p_username: username });
  if (error) return { ok: false, error: friendlyError(error) };
  if (typeof data !== 'string' || !data) return { ok: false, error: wrongLogin() };
  return signInByEmail(client, data, password);
}

/**
 * Create an account. The username goes in the user's metadata, where a database trigger claims
 * it in public.usernames; a quick `username_available` check first gives a clear "taken" message.
 */
export async function signUp(email: string, password: string, username: string): Promise<AuthResult> {
  if (!supabase) {
    await AsyncStorage.setItem(LOCAL_SESSION_KEY, '1');
    return { ok: true };
  }
  const name = normalizeUsername(username);
  const taken = { ok: false as const, error: friendlyError(codedError('usernameTaken')), field: 'username' as const };
  const check = await supabase.rpc('username_available', { p_username: name });
  if (check.error) return { ok: false, error: friendlyError(check.error) };
  if (check.data === false) return taken;
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { username: name } } });
  if (error) {
    // Someone took the name between the check and the sign-up: the trigger's unique index fails
    // the insert, which Supabase reports as a generic database error.
    if (/database error saving new user/i.test(error.message)) {
      const again = await supabase.rpc('username_available', { p_username: name });
      if (again.data === false) return taken;
    }
    return { ok: false, error: friendlyError(error) };
  }
  // With email confirmation on, Supabase returns a user but no session yet.
  return { ok: true, needsConfirmation: !data.session, email: email.trim() };
}

/**
 * Resend the confirmation email for an unconfirmed account.
 * Supabase rate-limits this automatically.
 */
export async function resendConfirmation(email: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: true };
  const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
  return error ? { ok: false, error: friendlyError(error) } : { ok: true };
}

export async function signOut(): Promise<void> {
  // Half-finished setup answers (name, access needs) shouldn't stay on a shared device.
  await clearSavedDraft();
  // While still signed in: e.g. close an open help request, which the server refuses once signed out.
  await runBeforeSignOut();
  if (!supabase) {
    await AsyncStorage.removeItem(LOCAL_SESSION_KEY);
    return;
  }
  // Revoke on the server first (global), so a copied token stops working. That call returns
  // early on a network failure and leaves the session stored, so fall back to clearing this
  // device's session (local), which needs no network: offline sign-out still signs out.
  const { error } = await supabase.auth.signOut();
  if (error) await supabase.auth.signOut({ scope: 'local' });
}

export async function currentUserId(): Promise<string | null> {
  if (!supabase) {
    return (await AsyncStorage.getItem(LOCAL_SESSION_KEY)) ? LOCAL_USER_ID : null;
  }
  const { data, error } = await supabase.auth.getSession();
  // An expired token that can't refresh because we're offline is a load error, not "signed out":
  // throwing lets the app show "Can't reach VenU" and keep the saved session. Any other error
  // (revoked refresh token, deleted user) has already cleared the session, so it is signed out.
  if (error && !data.session && isAuthRetryableFetchError(error)) throw error;
  return data.session?.user.id ?? null;
}
