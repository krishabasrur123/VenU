// Forgot password by username as a plain (Request) => Response function. index.ts serves it on
// Supabase (Deno); scripts/mock-supabase.mjs serves the same function in Node. (An email doesn't
// need it: the app calls supabase.auth.resetPasswordForEmail directly.)
//
// The email behind a username never leaves the server, and the reply never says whether the
// username exists: known, unknown, or refused by Auth, it's the same 200. Auth sends the email
// itself (POST /auth/v1/recover), so its templates, redirect allow list and rate limits apply.
//   POST { username: 'Rosa_M', redirectTo: 'https://venu.app/reset-password' } → 200 { sent: true }
//   POST { username: 'nobody' }                                                → 200 { sent: true }
//   POST { username: 42 }                                                      → 400 { code: 'bad_request' }

import { clientIpOf, CORS, json } from '../_shared/edge.ts';

export type RecoverResult = { ok: true } | { ok: false; status: number; code: string | null };

export interface HandlerDeps {
  /** The email for a normalized username, or null (public.email_for_username, service role only). */
  emailForUsername(username: string): Promise<string | null>;
  /** Supabase Auth's recover endpoint: emails a reset link. `clientIp` is for Auth's per-IP rate limits. */
  sendRecovery(email: string, redirectTo: string | null, clientIp: string | null): Promise<RecoverResult>;
  log?: (line: string) => void;
}

/** Matches the usernames table check (supabase/migrations/20261116000000_usernames.sql). */
const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;
const MAX_USERNAME_CHARS = 100;
const MAX_REDIRECT_CHARS = 500;

/** The one reply for any well-formed username, so the answer can't be used to find accounts. */
const sent = () => json(200, { sent: true });

/** Where the link should land: an http(s) or app-scheme URL. Auth still checks it against the project's allow list. */
function redirectOf(v: unknown): string | null {
  if (typeof v !== 'string' || !v || v.length > MAX_REDIRECT_CHARS) return null;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : null;
}

export function createHandler({ emailForUsername, sendRecovery, log = console.error }: HandlerDeps) {
  return async function handle(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (req.method !== 'POST') return json(405, { code: 'method_not_allowed', message: 'Use POST.' });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = null;
    }
    const { username, redirectTo } = (body ?? {}) as { username?: unknown; redirectTo?: unknown };
    if (typeof username !== 'string' || !username.trim() || username.length > MAX_USERNAME_CHARS) {
      return json(400, { code: 'bad_request', message: 'Send a JSON object: { username, redirectTo? }.' });
    }

    const name = username.trim().toLowerCase();
    if (!USERNAME_RE.test(name)) return sent();

    let email: string | null;
    try {
      email = await emailForUsername(name);
    } catch (e) {
      // Fails the same for every username, so saying so reveals nothing.
      log(`password-reset: lookup failed: ${e instanceof Error ? e.message : String(e)}`);
      return json(502, { code: 'unexpected_failure', message: 'Could not send the link. Try again later.' });
    }
    if (!email) return sent();

    try {
      const result = await sendRecovery(email, redirectOf(redirectTo), clientIpOf(req).ip);
      // Never the email in the log, only what failed. The caller still hears "sent": an error here
      // (e.g. rate limited) only happens for usernames that exist.
      if (!result.ok) log(`password-reset: auth refused with ${result.status} ${result.code ?? '(no code)'}`);
    } catch (e) {
      log(`password-reset: auth unreachable: ${e instanceof Error ? e.message : String(e)}`);
    }
    return sent();
  };
}

/**
 * Auth's recover endpoint over HTTP (POST /auth/v1/recover?redirect_to=…), for index.ts and the mock.
 * Sb-Forwarded-For: see httpPasswordGrant in ../username-sign-in/handler.ts.
 */
export function httpRecover(baseUrl: string, apiKey: string, fetchFn: typeof fetch = fetch): HandlerDeps['sendRecovery'] {
  return async (email, redirectTo, clientIp) => {
    const query = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : '';
    const res = await fetchFn(`${baseUrl.replace(/\/$/, '')}/auth/v1/recover${query}`, {
      method: 'POST',
      headers: { apikey: apiKey, 'Content-Type': 'application/json', ...(clientIp ? { 'Sb-Forwarded-For': clientIp } : {}) },
      body: JSON.stringify({ email }),
    });
    if (res.ok) return { ok: true };
    const reply = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const code = typeof reply?.error_code === 'string' ? reply.error_code : typeof reply?.code === 'string' ? reply.code : null;
    return { ok: false, status: res.status, code };
  };
}
