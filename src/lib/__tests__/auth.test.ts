import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// A stand-in Supabase client: usernames → emails, and which calls the app made.
const mockAccounts: Record<string, string> = { rosa_m: 'rosa@example.com' };
const mockRpc = jest.fn(async (fn: string, args: { p_username: string }) => {
  if (fn === 'email_for_username') return { data: mockAccounts[args.p_username] ?? null, error: null };
  if (fn === 'username_available') return { data: !(args.p_username in mockAccounts), error: null };
  return { data: null, error: { message: `unknown function ${fn}` } };
});
const mockSignInWithPassword = jest.fn(async (_: { email: string; password: string }) => ({ data: {}, error: null }));
const mockSignUp = jest.fn(async (_: unknown) => ({ data: { session: { access_token: 't' } }, error: null }));
// The username-sign-in Edge Function: a session for rosa_m / 'pw', else Auth's wrong-password reply.
type Invoked = { data: unknown; error: unknown; response?: Response };
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const mockInvoke = jest.fn(async (_fn: string, { body }: { body: { username: string; password: string } }): Promise<Invoked> => {
  if (body.username === 'rosa_m' && body.password === 'pw') return { data: { access_token: 'at', refresh_token: 'rt' }, error: null };
  const response = reply(400, { code: 'invalid_credentials', message: 'Invalid login credentials' });
  return { data: null, error: new Error('Edge Function returned a non-2xx status code'), response };
});
const mockSetSession = jest.fn(async (_: { access_token: string; refresh_token: string }) => ({
  data: { user: { email: 'rosa@example.com' }, session: {} },
  error: null,
}));
// After a sign-in the app checks the email was confirmed (signs an unconfirmed one back out).
const mockGetUser = jest.fn(async () => ({ data: { user: { email: 'rosa@example.com', email_confirmed_at: '2026-11-01T00:00:00Z' } }, error: null }));
const mockSignOut = jest.fn(async (_: { scope: string }) => ({ error: null }));

// Wrapped so the mocks are read at call time: the import below is hoisted above the consts.
jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (fn: string, args: { p_username: string }) => mockRpc(fn, args),
    functions: { invoke: (fn: string, options: { body: { username: string; password: string } }) => mockInvoke(fn, options) },
    auth: {
      signInWithPassword: (creds: { email: string; password: string }) => mockSignInWithPassword(creds),
      signUp: (body: unknown) => mockSignUp(body),
      setSession: (tokens: { access_token: string; refresh_token: string }) => mockSetSession(tokens),
      getUser: () => mockGetUser(),
      signOut: (options: { scope: string }) => mockSignOut(options),
    },
  },
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// eslint-disable-next-line import/first
import { signIn, signUp as createAccount } from '../auth';

beforeEach(() => {
  mockRpc.mockClear();
  mockSignInWithPassword.mockClear();
  mockSignUp.mockClear();
  mockInvoke.mockClear();
  mockSetSession.mockClear();
  mockGetUser.mockClear();
  mockSignOut.mockClear();
});

describe('signIn', () => {
  it('signs a username in through the Edge Function and takes the email from the new session', async () => {
    expect(await signIn('  Rosa_M ', 'pw')).toEqual({ ok: true, email: 'rosa@example.com' });
    expect(mockInvoke).toHaveBeenCalledWith('username-sign-in', { body: { username: 'rosa_m', password: 'pw' } });
    expect(mockSetSession).toHaveBeenCalledWith({ access_token: 'at', refresh_token: 'rt' });
    // The email is never looked up from the app.
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it('signs in with an email directly', async () => {
    expect(await signIn(' rosa@example.com ', 'pw')).toEqual({ ok: true, email: 'rosa@example.com' });
    expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: 'rosa@example.com', password: 'pw' });
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('signs an unconfirmed account back out and asks for the confirmation', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { email: 'rosa@example.com', email_confirmed_at: null } }, error: null } as never);
    expect(await signIn('rosa@example.com', 'pw')).toEqual({ ok: true, needsConfirmation: true, email: 'rosa@example.com' });
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it("shows the function's refusal as the wrong-password message", async () => {
    expect(await signIn('nobody', 'pw')).toEqual({ ok: false, error: 'Wrong username or password.' });
    expect(await signIn('rosa_m', 'nope')).toEqual({ ok: false, error: 'Wrong username or password.' });
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it('says "offline" when the function cannot be reached', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: Object.assign(new Error('Failed to send a request to the Edge Function'), { context: new TypeError('Failed to fetch') }) });
    expect(await signIn('rosa_m', 'pw')).toEqual({ ok: false, error: expect.stringMatching(/reach VenU/) });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  describe('before the function is deployed (404)', () => {
    const notFound = async (): Promise<Invoked> => ({
      data: null,
      error: new Error('Edge Function returned a non-2xx status code'),
      response: reply(404, { code: 'NOT_FOUND', message: 'Requested function was not found' }),
    });

    it('falls back to the email_for_username lookup', async () => {
      mockInvoke.mockImplementationOnce(notFound);
      expect(await signIn('Rosa_M', 'pw')).toEqual({ ok: true, email: 'rosa@example.com' });
      expect(mockRpc).toHaveBeenCalledWith('email_for_username', { p_username: 'rosa_m' });
      expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: 'rosa@example.com', password: 'pw' });
    });

    it('still words an unknown username like a wrong password, without trying to sign in', async () => {
      mockInvoke.mockImplementationOnce(notFound);
      expect(await signIn('nobody', 'pw')).toEqual({ ok: false, error: 'Wrong username or password.' });
      expect(mockSignInWithPassword).not.toHaveBeenCalled();
    });
  });
});

describe('signUp', () => {
  it('sends the username (lower case) as user metadata', async () => {
    expect(await createAccount('daniel@example.com', 'longenough', 'Daniel_K')).toMatchObject({ ok: true, needsConfirmation: false });
    expect(mockSignUp).toHaveBeenCalledWith({ email: 'daniel@example.com', password: 'longenough', options: { data: { username: 'daniel_k' } } });
  });

  it('stops on a taken username and points at the field', async () => {
    expect(await createAccount('other@example.com', 'longenough', 'rosa_m')).toEqual({
      ok: false,
      error: 'That username is taken. Try another.',
      field: 'username',
    });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('reports "taken" when someone claims the name between the check and the sign-up', async () => {
    // The claim_username trigger fails the insert, which Supabase words as a generic database error.
    mockSignUp.mockImplementationOnce(async () => {
      mockAccounts.sam = 'sam@example.com';
      return { data: { session: null }, error: { message: 'Database error saving new user' } } as never;
    });
    expect(await createAccount('other@example.com', 'longenough', 'Sam')).toEqual({
      ok: false,
      error: 'That username is taken. Try another.',
      field: 'username',
    });
    expect(mockRpc.mock.calls.filter(([fn]) => fn === 'username_available')).toHaveLength(2);
    delete mockAccounts.sam;
  });
});
