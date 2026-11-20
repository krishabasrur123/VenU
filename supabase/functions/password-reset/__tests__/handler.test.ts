/**
 * @jest-environment node
 */
import { describe, expect, it, jest } from '@jest/globals';

import { createHandler, httpRecover, type RecoverResult } from '../handler.ts';

function setup() {
  const emailForUsername = jest.fn(async (name: string) => (name === 'rosa_m' ? 'rosa@example.com' : null));
  const sendRecovery = jest.fn(async (_email: string, _redirect: string | null, _ip: string | null): Promise<RecoverResult> => ({ ok: true }));
  const log = jest.fn();
  return { handle: createHandler({ emailForUsername, sendRecovery, log }), emailForUsername, sendRecovery, log };
}

const call = (handle: (r: Request) => Promise<Response>, body: unknown, method = 'POST', headers: Record<string, string> = {}) =>
  handle(new Request('http://x/functions/v1/password-reset', {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  }));

const SENT = { sent: true };
const REDIRECT = 'https://venu.example/reset-password';

describe('password-reset function', () => {
  it('sends the link for a username (any case) to its email, with the redirect and caller IP', async () => {
    const { handle, emailForUsername, sendRecovery } = setup();
    const res = await call(handle, { username: '  Rosa_M ', redirectTo: REDIRECT }, 'POST', { 'Cf-Connecting-Ip': '203.0.113.7' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(SENT);
    expect(JSON.stringify(body)).not.toContain('rosa@example.com');
    expect(emailForUsername).toHaveBeenCalledWith('rosa_m');
    expect(sendRecovery).toHaveBeenCalledWith('rosa@example.com', REDIRECT, '203.0.113.7');
  });

  it('answers an unknown username exactly like a known one, without calling Auth', async () => {
    const { handle, sendRecovery } = setup();
    const known = await call(handle, { username: 'rosa_m' });
    const unknown = await call(handle, { username: 'nobody' });
    expect([unknown.status, await unknown.json()]).toEqual([known.status, await known.json()]);
    expect(sendRecovery).toHaveBeenCalledTimes(1);
  });

  it.each([['an email', 'rosa@example.com'], ['a malformed name', 'ro'], ['other characters', 'rosa m!']])(
    'treats %s as no such username, without a lookup', async (_, username) => {
      const { handle, emailForUsername } = setup();
      const res = await call(handle, { username });
      expect([res.status, await res.json()]).toEqual([200, SENT]);
      expect(emailForUsername).not.toHaveBeenCalled();
    },
  );

  it('still says "sent" when Auth refuses or is down (only real accounts get that far), logging no email', async () => {
    const { handle, sendRecovery, log } = setup();
    sendRecovery.mockResolvedValueOnce({ ok: false, status: 429, code: 'over_email_send_rate_limit' });
    expect([(await call(handle, { username: 'rosa_m' })).status]).toEqual([200]);
    sendRecovery.mockRejectedValueOnce(new Error('fetch failed'));
    expect(await (await call(handle, { username: 'rosa_m' })).json()).toEqual(SENT);
    const logged = log.mock.calls.flat().join('\n');
    expect(logged).toContain('over_email_send_rate_limit');
    expect(logged).not.toContain('rosa@example.com');
  });

  it('answers 502 when the lookup itself fails (the same for every username)', async () => {
    const { handle, emailForUsername } = setup();
    emailForUsername.mockRejectedValueOnce(new Error('db down'));
    expect((await call(handle, { username: 'nobody' })).status).toBe(502);
  });

  it.each([
    ['a relative path', '/reset-password'],
    ['javascript:', 'javascript:alert(1)'],
    ['a number', 42],
    ['a huge URL', `https://x.example/${'a'.repeat(600)}`],
  ])('drops a redirect that is %s (Auth then uses the Site URL)', async (_, redirectTo) => {
    const { handle, sendRecovery } = setup();
    await call(handle, { username: 'rosa_m', redirectTo });
    expect(sendRecovery.mock.calls[0][1]).toBeNull();
  });

  it('keeps an app-scheme redirect for the phone app', async () => {
    const { handle, sendRecovery } = setup();
    await call(handle, { username: 'rosa_m', redirectTo: 'venu://reset-password' });
    expect(sendRecovery.mock.calls[0][1]).toBe('venu://reset-password');
  });

  it.each([
    ['not JSON', '{'],
    ['null', null],
    ['no username', {}],
    ['a non-string username', { username: 42 }],
    ['an empty username', { username: '  ' }],
    ['a huge username', { username: 'x'.repeat(101) }],
  ])('rejects %s with 400 bad_request', async (_, body) => {
    const { handle, emailForUsername } = setup();
    const res = await call(handle, body);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('bad_request');
    expect(emailForUsername).not.toHaveBeenCalled();
  });

  it('answers CORS preflight and refuses other methods', async () => {
    const { handle } = setup();
    const pre = await call(handle, null, 'OPTIONS');
    expect(pre.status).toBe(204);
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect((await call(handle, null, 'GET')).status).toBe(405);
  });
});

describe('httpRecover', () => {
  it('posts the email to Auth with the redirect, key and forwarded IP', async () => {
    const fetchFn = jest.fn(async (_url: string, _init: RequestInit) => new Response('{}', { status: 200 }));
    const recover = httpRecover('https://p.supabase.co/', 'sb_secret_x', fetchFn as unknown as typeof fetch);
    expect(await recover('rosa@example.com', REDIRECT, '203.0.113.7')).toEqual({ ok: true });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(`https://p.supabase.co/auth/v1/recover?redirect_to=${encodeURIComponent(REDIRECT)}`);
    expect(init.headers).toMatchObject({ apikey: 'sb_secret_x', 'Sb-Forwarded-For': '203.0.113.7' });
    expect(JSON.parse(String(init.body))).toEqual({ email: 'rosa@example.com' });
  });

  it("leaves the redirect off when there is none, and reports Auth's error code", async () => {
    const fetchFn = jest.fn(async (_url: string) =>
      new Response(JSON.stringify({ code: 429, error_code: 'over_email_send_rate_limit', msg: 'email rate limit exceeded' }), { status: 429 }));
    const recover = httpRecover('https://p.supabase.co', 'k', fetchFn as unknown as typeof fetch);
    expect(await recover('a@b.c', null, null)).toEqual({ ok: false, status: 429, code: 'over_email_send_rate_limit' });
    expect(fetchFn.mock.calls[0][0]).toBe('https://p.supabase.co/auth/v1/recover');
  });
});
