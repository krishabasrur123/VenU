import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Stand-ins for the Supabase client, the detached client a reset link uses, and the in-app browser.
type Invoked = { data: unknown; error: unknown; response?: Response };
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const mockInvoke = jest.fn(async (_fn: string, _options: { body: unknown }): Promise<Invoked> => ({ data: { sent: true }, error: null }));
const mockReset = jest.fn(async (_email: string, _options: { redirectTo: string }) => ({ data: {}, error: null as unknown }));
const mockSetSession = jest.fn(async (_: { access_token: string; refresh_token: string }) => ({
  data: { user: { id: 'u1', email: 'google-user@mock.venu', user_metadata: { full_name: 'Google User' } } as { id: string; email: string; user_metadata: Record<string, unknown> } | null, session: {} },
  error: null as unknown,
}));
const mockOAuth = jest.fn(async (_: { provider: string; options: { redirectTo: string; skipBrowserRedirect?: boolean } }) => ({
  data: { provider: 'google', url: 'https://p.supabase.co/auth/v1/authorize?provider=google' },
  error: null as unknown,
}));
const mockGetSession = jest.fn(async () => ({ data: { session: null as null | { user: { id: string } } } }));
const mockMainSignOut = jest.fn(async (_?: { scope: string }) => ({ error: null }));
const mockDetached = {
  setSession: jest.fn(async (_: { access_token: string; refresh_token: string }) => ({ data: { user: { id: 'u1' } }, error: null as unknown })),
  updateUser: jest.fn(async (_: { password: string }) => ({ data: {}, error: null as unknown })),
  signOut: jest.fn(async () => ({ error: null })),
};
const mockOpenAuthSession = jest.fn(async (_url: string, _redirect: string): Promise<{ type: string; url?: string }> => ({
  type: 'success',
  url: 'venu://auth-callback#access_token=at&refresh_token=rt&token_type=bearer',
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: { invoke: (fn: string, options: { body: unknown }) => mockInvoke(fn, options) },
    auth: {
      resetPasswordForEmail: (email: string, options: { redirectTo: string }) => mockReset(email, options),
      setSession: (t: { access_token: string; refresh_token: string }) => mockSetSession(t),
      signInWithOAuth: (o: { provider: string; options: { redirectTo: string } }) => mockOAuth(o),
      getSession: () => mockGetSession(),
      signOut: (o?: { scope: string }) => mockMainSignOut(o),
    },
  },
  supabaseConfig: { url: 'https://p.supabase.co', anonKey: 'pk' },
  createDetachedClient: () => ({ auth: mockDetached }),
}));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: (url: string, redirect: string) => mockOpenAuthSession(url, redirect) }));
jest.mock('expo-linking', () => ({ createURL: (path: string) => `venu://${path}`, getLinkingURL: () => null }));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// eslint-disable-next-line import/first
import { readPendingSetup } from '@/features/auth/pending-setup';
// eslint-disable-next-line import/first
import { completeOAuthRedirect, deleteAccount, requestPasswordReset, setPasswordFromLink, signInWithProvider } from '../account';

const settings = (external: Record<string, boolean>) =>
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ external })) as never);

beforeEach(() => {
  jest.restoreAllMocks();
  for (const m of [mockInvoke, mockReset, mockSetSession, mockOAuth, mockGetSession, mockMainSignOut, mockOpenAuthSession, ...Object.values(mockDetached)]) m.mockClear();
});

describe('requestPasswordReset', () => {
  it('sends an email straight to Auth, back to /reset-password', async () => {
    expect(await requestPasswordReset(' rosa@example.com ')).toEqual({ ok: true });
    expect(mockReset).toHaveBeenCalledWith('rosa@example.com', { redirectTo: 'venu://reset-password' });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('sends a username to the password-reset function, which looks the email up', async () => {
    expect(await requestPasswordReset('  Rosa_M ')).toEqual({ ok: true });
    expect(mockInvoke).toHaveBeenCalledWith('password-reset', { body: { username: 'rosa_m', redirectTo: 'venu://reset-password' } });
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('asks for the email when the function is not deployed', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: new Error('404'), response: reply(404, { code: 'NOT_FOUND' }) });
    expect(await requestPasswordReset('rosa_m')).toEqual({ ok: false, error: 'Resetting by username isn’t available yet. Enter your email instead.' });
  });

  it('words an Auth refusal (e.g. rate limit) as a sentence', async () => {
    mockReset.mockResolvedValueOnce({ data: {}, error: { code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' } });
    expect(await requestPasswordReset('rosa@example.com')).toEqual({ ok: false, error: 'Too many tries. Wait a minute and try again.' });
  });
});

describe('setPasswordFromLink', () => {
  const tokens = { accessToken: 'at', refreshToken: 'rt' };

  it("uses the link's session on its own client, sets the password, then signs out everywhere", async () => {
    expect(await setPasswordFromLink(tokens, 'new-password')).toEqual({ ok: true });
    expect(mockDetached.setSession).toHaveBeenCalledWith({ access_token: 'at', refresh_token: 'rt' });
    expect(mockDetached.updateUser).toHaveBeenCalledWith({ password: 'new-password' });
    expect(mockDetached.signOut).toHaveBeenCalledWith();
    // The app's own session (another account here) is left alone.
    expect(mockSetSession).not.toHaveBeenCalled();
    expect(mockMainSignOut).not.toHaveBeenCalled();
  });

  it('drops this device’s session when it is the same account (its refresh token was just revoked)', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'u1' } } } });
    await setPasswordFromLink(tokens, 'new-password');
    expect(mockMainSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('explains an expired link and a reused password', async () => {
    mockDetached.setSession.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: { code: 'refresh_token_not_found', message: 'Invalid Refresh Token' } });
    expect(await setPasswordFromLink(tokens, 'new-password')).toEqual({ ok: false, error: 'Your session expired. Please sign in again.' });
    mockDetached.updateUser.mockResolvedValueOnce({ data: {}, error: { code: 'same_password', message: 'New password should be different' } });
    expect(await setPasswordFromLink(tokens, 'new-password')).toEqual({ ok: false, error: 'Choose a password different from your current one.' });
  });
});

describe('signInWithProvider', () => {
  it('says a provider that is off isn’t set up, without leaving for Supabase’s error page', async () => {
    settings({ google: false, apple: true });
    expect(await signInWithProvider('google')).toEqual({ ok: false, error: 'Google sign-in isn’t set up yet. Create an account with your email instead.' });
    expect(mockOAuth).not.toHaveBeenCalled();
  });

  it('on a phone: opens the in-app browser and stores the session it comes back with', async () => {
    settings({ google: true });
    expect(await signInWithProvider('google')).toEqual({ ok: true });
    expect(mockOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: 'venu://auth-callback', skipBrowserRedirect: true } });
    expect(mockOpenAuthSession).toHaveBeenCalledWith('https://p.supabase.co/auth/v1/authorize?provider=google', 'venu://auth-callback');
    expect(mockSetSession).toHaveBeenCalledWith({ access_token: 'at', refresh_token: 'rt' });
  });

  it('closing the browser is a cancel, not an error', async () => {
    settings({ facebook: true });
    mockOpenAuthSession.mockResolvedValueOnce({ type: 'cancel' });
    expect(await signInWithProvider('facebook')).toEqual({ ok: false, cancelled: true });
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it('offline: says so', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch') as never);
    expect(await signInWithProvider('apple')).toEqual({ ok: false, error: "Can't reach VenU. Check your connection and try again." });
  });
});

describe('completeOAuthRedirect', () => {
  it('stores the session and keeps the provider’s first name for setup', async () => {
    expect(await completeOAuthRedirect('https://venu.example/auth-callback#access_token=at&refresh_token=rt')).toEqual({ ok: true });
    expect(mockSetSession).toHaveBeenCalledWith({ access_token: 'at', refresh_token: 'rt' });
    expect(await readPendingSetup()).toMatchObject({ firstName: 'Google', email: 'google-user@mock.venu' });
  });

  it.each([
    ['a cancel at the provider', '#error=access_denied&error_description=The+user+denied', 'Sign-in was cancelled. Try again, or use your email.'],
    ['a provider that is off', '?error=validation_failed&error_description=Unsupported+provider%3A+provider+is+not+enabled', 'That sign-in option isn’t set up yet. Create an account with your email instead.'],
    ['anything else', '#error=server_error&error_description=Unable+to+exchange+external+code', 'Couldn’t sign in with that account. Try again, or use your email.'],
    ['no session at all', '', 'Couldn’t sign in with that account. Try again, or use your email.'],
  ])('explains %s', async (_, suffix, message) => {
    expect(await completeOAuthRedirect(`https://venu.example/auth-callback${suffix}`)).toEqual({ ok: false, error: message });
    expect(mockSetSession).not.toHaveBeenCalled();
  });
});

describe('deleteAccount', () => {
  it("calls delete-account with the user's own token", async () => {
    mockInvoke.mockResolvedValueOnce({ data: { deleted: true }, error: null });
    expect(await deleteAccount()).toBe('deleted');
    expect(mockInvoke).toHaveBeenCalledWith('delete-account', { body: {} });
  });

  it("reports a function that isn't deployed, so the app can fall back and say the sign-in remains", async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: new Error('404'), response: reply(404, { code: 'NOT_FOUND' }) });
    expect(await deleteAccount()).toBe('notDeployed');
  });

  it('throws an expired session and a server failure', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: new Error('401'), response: reply(401, { code: 'not_signed_in' }) });
    await expect(deleteAccount()).rejects.toMatchObject({ code: 'session_not_found' });
    mockInvoke.mockResolvedValueOnce({ data: null, error: new Error('502'), response: reply(502, { code: 'unexpected_failure' }) });
    await expect(deleteAccount()).rejects.toMatchObject({ code: 'unexpected_failure' });
  });
});
