// Sign In by username as a plain (Request) => Response function. index.ts serves it on Supabase
// (Deno); scripts/mock-supabase.mjs serves the same function in Node.
//
// The email behind a username never leaves the server: the function looks it up (service role),
// signs in with Supabase Auth's own password grant (so Auth's rate limits and checks still apply)
// and returns only the session. Any failure that isn't the password reads like a wrong password.
//   POST { username: 'Rosa_M', password: '…' } → 200 { access_token, refresh_token }
//   POST { username: 'nobody', password: '…' } → 400 { code: 'invalid_credentials', message: 'Invalid login credentials' }

import { clientIpOf, CORS, json, type ClientIpSource } from '../_shared/edge.ts';

/** A session as the app hands it to supabase.auth.setSession(). */
export interface SignInSession {
  access_token: string;
  refresh_token: string;
}

export type GrantResult = { ok: true; session: SignInSession } | { ok: false; status: number; code: string | null };

export interface HandlerDeps {
  /** The email for a normalized username, or null (public.email_for_username, service role only). */
  emailForUsername(username: string): Promise<string | null>;
  /** Supabase Auth's password grant. `clientIp` is the caller's address, for Auth's per-IP rate limits. */
  passwordGrant(email: string, password: string, clientIp: string | null): Promise<GrantResult>;
  log?: (line: string) => void;
}

/** Matches the usernames table check (supabase/migrations/20261116000000_usernames.sql). */
const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;
/** Generous caps so a huge body can't keep the function busy; real values are far shorter. */
const MAX_USERNAME_CHARS = 100;
const MAX_PASSWORD_CHARS = 1000;

/** Auth error codes passed on as they are (same code, status and wording as Auth's own reply). */
const PASS_ON: Record<string, { status: number; message: string }> = {
  invalid_credentials: { status: 400, message: 'Invalid login credentials' },
  email_not_confirmed: { status: 400, message: 'Email not confirmed' },
  over_request_rate_limit: { status: 429, message: 'Request rate limit reached' },
  user_banned: { status: 400, message: 'User is banned' },
};
const wrongLogin = () => json(400, { code: 'invalid_credentials', message: PASS_ON.invalid_credentials.message });

const IP_SOURCE_LOG: Record<ClientIpSource, string> = {
  'cf-connecting-ip': "username-sign-in: Auth rate-limits sign-ins by the caller's Cf-Connecting-Ip",
  none: "username-sign-in: no Cf-Connecting-Ip; Auth rate-limits sign-ins by the function's own IP",
};

export function createHandler({ emailForUsername, passwordGrant, log = console.error }: HandlerDeps) {
  // Which IP source sign-ins use, logged the first time each is seen in this instance (one per cold
  // start; never the IP itself), so the function's logs show what Auth counts.
  const ipSourcesLogged = new Set<ClientIpSource>();
  return async function handle(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (req.method !== 'POST') return json(405, { code: 'method_not_allowed', message: 'Use POST.' });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = null;
    }
    const { username, password } = (body ?? {}) as { username?: unknown; password?: unknown };
    if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password
      || username.length > MAX_USERNAME_CHARS || password.length > MAX_PASSWORD_CHARS) {
      return json(400, { code: 'bad_request', message: 'Send a JSON object: { username, password }.' });
    }

    // An email, or anything else no username can look like, is simply not a username. (Whether a
    // username exists is public anyway, through username_available; only its email is private.)
    const name = username.trim().toLowerCase();
    if (!USERNAME_RE.test(name)) return wrongLogin();

    let email: string | null;
    try {
      email = await emailForUsername(name);
    } catch (e) {
      log(`username-sign-in: lookup failed: ${e instanceof Error ? e.message : String(e)}`);
      return json(502, { code: 'unexpected_failure', message: 'Sign-in failed. Try again later.' });
    }
    if (!email) return wrongLogin();

    const client = clientIpOf(req);
    if (!ipSourcesLogged.has(client.source)) {
      ipSourcesLogged.add(client.source);
      log(IP_SOURCE_LOG[client.source]);
    }

    let grant: GrantResult;
    try {
      grant = await passwordGrant(email, password, client.ip);
    } catch (e) {
      log(`username-sign-in: auth unreachable: ${e instanceof Error ? e.message : String(e)}`);
      return json(502, { code: 'unexpected_failure', message: 'Sign-in failed. Try again later.' });
    }
    if (grant.ok) return json(200, { access_token: grant.session.access_token, refresh_token: grant.session.refresh_token });

    // The account went away between the lookup and the grant: same as no such username.
    if (grant.code === 'user_not_found') return wrongLogin();
    const known = grant.code ? PASS_ON[grant.code] : undefined;
    if (known) return json(known.status, { code: grant.code, message: known.message });
    // Never the email or password in the log, only what failed.
    log(`username-sign-in: auth refused with ${grant.status} ${grant.code ?? '(no code)'}`);
    return json(502, { code: 'unexpected_failure', message: 'Sign-in failed. Try again later.' });
  };
}

/**
 * The password grant over HTTP (POST /auth/v1/token?grant_type=password), for index.ts and the mock.
 * With a secret key (sb_secret_…) and IP Address Forwarding on (Auth > Rate Limits), Sb-Forwarded-For
 * makes Auth rate-limit by the caller's IP instead of the function's; other keys ignore the header.
 */
export function httpPasswordGrant(baseUrl: string, apiKey: string, fetchFn: typeof fetch = fetch): HandlerDeps['passwordGrant'] {
  return async (email, password, clientIp) => {
    const res = await fetchFn(`${baseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: apiKey, 'Content-Type': 'application/json', ...(clientIp ? { 'Sb-Forwarded-For': clientIp } : {}) },
      body: JSON.stringify({ email, password }),
    });
    const reply = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (res.ok && typeof reply?.access_token === 'string' && typeof reply.refresh_token === 'string') {
      return { ok: true, session: { access_token: reply.access_token, refresh_token: reply.refresh_token } };
    }
    const code = typeof reply?.error_code === 'string' ? reply.error_code : typeof reply?.code === 'string' ? reply.code : null;
    return { ok: false, status: res.status, code };
  };
}
