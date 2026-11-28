/**
 * @jest-environment node
 */
// scripts/mock-supabase.mjs serves password reset (/auth/v1/recover → printed link → /auth/v1/verify
// → PUT /auth/v1/user), the password-reset and delete-account Edge Functions, and a fake social
// sign-in (/auth/v1/authorize), so the app's flows run on localhost. Runs the real mock in a child
// process and talks HTTP to it (node:http: jest-expo swaps the global fetch for Expo's).
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { spawn, type ChildProcess } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { join } from 'node:path';

const SCRIPT = join(__dirname, '..', '..', '..', 'scripts', 'mock-supabase.mjs');
const APP = 'http://localhost:8093';

let mock: ChildProcess;
let base = '';
let out = '';

beforeAll(async () => {
  mock = spawn(process.execPath, [SCRIPT, '0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  base = await new Promise<string>((resolve, reject) => {
    mock.stdout!.on('data', chunk => {
      out += chunk;
      const m = /mock supabase on (http:\/\/localhost:\d+)/.exec(out);
      if (m) resolve(m[1]);
    });
    mock.once('exit', code => reject(new Error(`mock exited (${code}): ${out}`)));
  });
}, 20_000);

afterAll(() => {
  mock?.kill();
});

type Reply = { status: number; body: any; location: string | null };
function call(method: string, path: string, body?: unknown, token?: string): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) };
    const req = httpRequest(`${base}${path}`, { method, headers }, res => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => {
        let parsed: unknown = text;
        try { parsed = text ? JSON.parse(text) : null; } catch {}
        resolve({ status: res.statusCode ?? 0, body: parsed, location: (res.headers.location as string | undefined) ?? null });
      });
    });
    req.on('error', reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
const signUp = (email: string, username: string, password = 'first-pass') => call('POST', '/auth/v1/signup', { email, password, data: { username } });
const passwordGrant = (email: string, password: string) => call('POST', '/auth/v1/token?grant_type=password', { email, password });
const fragmentOf = (location: string | null) => new URLSearchParams((location ?? '').split('#')[1] ?? '');
/** The last reset link the mock printed for `email`, then the next one waits for a new print. */
async function printedLink(email: string): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const m = [...out.matchAll(/Password reset "email" for (\S+): (\S+)/g)].filter(x => x[1] === email).at(-1);
    if (m) return m[2];
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error(`no reset link printed for ${email}`);
}

describe('mock password reset', () => {
  it('prints a link for a known email, which signs into a recovery session that sets a new password', async () => {
    await signUp('reset@example.com', 'reset_me');
    const sent = await call('POST', `/auth/v1/recover?redirect_to=${encodeURIComponent(`${APP}/reset-password`)}`, { email: 'Reset@Example.com' });
    expect(sent).toMatchObject({ status: 200, body: {} });
    const link = new URL(await printedLink('reset@example.com'));
    expect(link.pathname).toBe('/auth/v1/verify');

    const opened = await call('GET', `${link.pathname}${link.search}`);
    expect(opened.status).toBe(303);
    expect(opened.location!.startsWith(`${APP}/reset-password#`)).toBe(true);
    const f = fragmentOf(opened.location);
    expect(f.get('type')).toBe('recovery');

    expect((await call('PUT', '/auth/v1/user', { password: 'first-pass' }, f.get('access_token')!)).body.code).toBe('same_password');
    expect((await call('PUT', '/auth/v1/user', { password: '123' }, f.get('access_token')!)).body.code).toBe('weak_password');
    expect((await call('PUT', '/auth/v1/user', { password: 'second-pass' }, f.get('access_token')!)).status).toBe(200);
    expect((await passwordGrant('reset@example.com', 'first-pass')).status).toBe(400);
    expect((await passwordGrant('reset@example.com', 'second-pass')).status).toBe(200);

    // One use only: the second open goes back with Auth's otp_expired.
    const again = await call('GET', `${link.pathname}${link.search}`);
    expect(fragmentOf(again.location).get('error_code')).toBe('otp_expired');
  });

  it('answers an unknown email the same way and prints nothing', async () => {
    const before = out.length;
    expect(await call('POST', '/auth/v1/recover', { email: 'nobody@example.com' })).toMatchObject({ status: 200, body: {} });
    expect(out.slice(before)).not.toContain('nobody@example.com');
  });

  it('runs the password-reset function: a username gets its email’s link, an unknown one the same reply', async () => {
    await signUp('byname@example.com', 'by_name');
    const known = await call('POST', '/functions/v1/password-reset', { username: 'By_Name', redirectTo: `${APP}/reset-password` });
    const unknown = await call('POST', '/functions/v1/password-reset', { username: 'nobody_here' });
    expect([known.status, known.body]).toEqual([200, { sent: true }]);
    expect([unknown.status, unknown.body]).toEqual([200, { sent: true }]);
    expect(decodeURIComponent(await printedLink('byname@example.com'))).toContain(`redirect_to=${APP}/reset-password`);
  });
});

describe('mock delete-account', () => {
  it('deletes the caller’s photos and sign-in, freeing the username; a stale token can’t do anything after', async () => {
    const { body: s } = await signUp('gone@example.com', 'gone_soon');
    const id = s.user.id;
    await call('POST', `/storage/v1/object/avatars/${id}/avatar-1`, 'x', s.access_token);
    expect((await call('POST', '/rest/v1/rpc/username_available', { p_username: 'gone_soon' })).body).toBe(false);

    expect(await call('POST', '/functions/v1/delete-account', {}, s.access_token)).toMatchObject({ status: 200, body: { deleted: true } });
    const state = (await call('GET', '/__state')).body;
    expect(state.users.some((u: { id: string }) => u.id === id)).toBe(false);
    expect(state.files.filter((f: string) => f.startsWith(`${id}/`))).toEqual([]);
    expect((await passwordGrant('gone@example.com', 'first-pass')).status).toBe(400);
    expect((await call('POST', '/rest/v1/rpc/username_available', { p_username: 'gone_soon' })).body).toBe(true);
    expect((await call('POST', '/functions/v1/delete-account', {}, s.access_token)).status).toBe(401);
  });

  it('refuses a caller without a token', async () => {
    expect((await call('POST', '/functions/v1/delete-account', {})).status).toBe(401);
  });

  it('keeps a finished request for the volunteer, without the deleted visitor’s id or messages', async () => {
    const visitor = (await signUp('v@example.com', 'visitor_x')).body;
    const vol = (await signUp('h@example.com', 'helper_x')).body;
    const profile = (s: any, role: string, name: string) => call('POST', '/rest/v1/profiles', {
      id: s.user.id, role, first_name: name, languages: ['en'], main_language: 'en', trainings: [],
    }, s.access_token);
    await profile(visitor, 'visitor', 'Vee');
    await profile(vol, 'volunteer', 'Hal');
    // Only verified volunteers can accept (LA28 staff verify them).
    expect((await call('POST', '/__control', { verify: 'helper_x' })).status).toBe(200);
    const req = (await call('POST', '/rest/v1/help_requests', { visitor_name: 'Vee', venue_id: 'sofi', help_types: ['lost'], language: 'en' }, visitor.access_token)).status;
    expect(req).toBe(201);
    const id = (await call('GET', '/__help')).body.requests.at(-1).id;
    await call('POST', '/rest/v1/rpc/accept_help_request', { p_request_id: id }, vol.access_token);
    await call('POST', '/rest/v1/messages', { request_id: id, text: 'Hi' }, visitor.access_token);
    await call('POST', '/rest/v1/messages', { request_id: id, text: 'Coming' }, vol.access_token);
    const report = { venue_id: 'sofi', facility_id: 'entry-4', title: 'Ramp is cracked', topic: 'accessibility', body: '', language: 'en' };
    expect((await call('POST', '/rest/v1/facility_reports', report, visitor.access_token)).status).toBe(201);
    expect((await call('POST', '/rest/v1/app_feedback', { note: 'Nice app', language: 'en', platform: 'web' }, visitor.access_token)).status).toBe(201);

    await call('POST', '/functions/v1/delete-account', {}, visitor.access_token);
    // 20261118010000_reports_feedback.sql: their reports go with them; app feedback stays without an author.
    const after = (await call('GET', '/__state')).body;
    expect(after.facility_reports.filter((r: { author_id: string }) => r.author_id === visitor.user.id)).toEqual([]);
    expect(after.app_feedback.find((r: { note: string }) => r.note === 'Nice app')).toMatchObject({ author_id: null });
    const help = (await call('GET', '/__help')).body;
    expect(help.requests.find((r: { id: string }) => r.id === id)).toMatchObject({ status: 'cancelled', visitor_id: null, visitor_name: 'Vee', volunteer_name: 'Hal' });
    expect(help.messages.filter((m: { request_id: string }) => m.request_id === id).map((m: { text: string }) => m.text)).toEqual(['Coming']);
    // The volunteer is free again.
    expect((await call('GET', '/rest/v1/help_requests', undefined, vol.access_token)).body.find((r: { id: string }) => r.id === id).status).toBe('cancelled');
  });
});

describe('mock social sign-in', () => {
  it('lists the providers as on, and /authorize comes straight back signed in as "<Provider> User"', async () => {
    expect((await call('GET', '/auth/v1/settings')).body.external).toMatchObject({ facebook: true, google: true, apple: true });
    const back = await call('GET', `/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(`${APP}/auth-callback`)}`);
    expect(back.status).toBe(302);
    expect(back.location!.startsWith(`${APP}/auth-callback#`)).toBe(true);
    const user = (await call('GET', '/auth/v1/user', undefined, fragmentOf(back.location).get('access_token')!)).body;
    expect(user).toMatchObject({ email: 'google-user@mock.venu', app_metadata: { provider: 'google' }, user_metadata: { full_name: 'Google User' } });
    // The same account the next time.
    const again = await call('GET', `/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(APP)}`);
    expect((await call('GET', '/auth/v1/user', undefined, fragmentOf(again.location).get('access_token')!)).body.id).toBe(user.id);
  });

  it('says a switched-off provider is off, in settings and at /authorize', async () => {
    await call('POST', '/__control', { disabledProviders: ['apple'] });
    expect((await call('GET', '/auth/v1/settings')).body.external.apple).toBe(false);
    const res = await call('GET', `/auth/v1/authorize?provider=apple&redirect_to=${encodeURIComponent(APP)}`);
    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/not enabled/);
    await call('POST', '/__control', { disabledProviders: [] });
  });
});
