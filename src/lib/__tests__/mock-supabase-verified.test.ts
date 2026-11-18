/**
 * @jest-environment node
 */
// scripts/mock-supabase.mjs mirrors 20261118020000_volunteer_settings_verified.sql: sign-ups start
// unverified and no client can change that, accept_help_request refuses unverified volunteers until
// the /__control verify hook (the dashboard, live) verifies them, and the settings columns
// (availability, notification_prefs) take only valid values from the owner.
// Runs the real mock in a child process and talks HTTP to it (node:http: jest-expo swaps the global
// fetch for Expo's).
import { afterAll, describe, expect, it } from '@jest/globals';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const SCRIPT = join(__dirname, '..', '..', '..', 'scripts', 'mock-supabase.mjs');
const running: ChildProcess[] = [];

/** Starts a mock on a free port, optionally keeping its state in `stateFile`; resolves with its base URL. */
function startMock(stateFile?: string): Promise<string> {
  const code = `import { startMockSupabase } from ${JSON.stringify(pathToFileURL(SCRIPT).href)};
    const server = await startMockSupabase({ port: 0, stateFile: ${JSON.stringify(stateFile ?? null)} ?? undefined, log: () => {} });
    console.log('mock supabase on http://localhost:' + server.address().port);`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', code], { stdio: ['ignore', 'pipe', 'pipe'] });
  running.push(child);
  return new Promise((resolve, reject) => {
    let out = '';
    child.stdout!.on('data', chunk => {
      out += chunk;
      const m = /mock supabase on (http:\/\/localhost:\d+)/.exec(out);
      if (m) resolve(m[1]);
    });
    child.stderr!.on('data', chunk => { out += chunk; });
    child.once('exit', c => reject(new Error(`mock exited (${c}): ${out}`)));
  });
}

afterAll(() => {
  for (const c of running) c.kill();
});

function call(base: string, method: string, path: string, body?: unknown, token?: string, headers: Record<string, string> = {}) {
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req = httpRequest(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    }, res => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => {
        let parsed: unknown = text;
        try { parsed = text ? JSON.parse(text) : null; } catch {}
        resolve({ status: res.statusCode ?? 0, body: parsed });
      });
    });
    req.on('error', reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

const ONE = { accept: 'application/vnd.pgrst.object+json', prefer: 'return=representation' };

async function account(base: string, email: string, username: string, role: 'visitor' | 'volunteer', extra: Record<string, unknown> = {}) {
  const { body: session } = await call(base, 'POST', '/auth/v1/signup', { email, password: 'longenough', data: { username } });
  const token: string = session.access_token;
  const id: string = session.user.id;
  const profile = await call(base, 'POST', '/rest/v1/profiles?select=*', {
    id, role, first_name: username, languages: ['en'], main_language: 'en', app_language: 'en',
    gender: role === 'volunteer' ? 'woman' : null, age_band: role === 'volunteer' ? 'under_40' : null,
    trainings: [], privacy_version: 'v1', privacy_accepted_at: new Date().toISOString(), ...extra,
  }, token, ONE);
  return { id, token, profile };
}

describe('mock verified volunteers and settings', () => {
  it('sign-ups start unverified, even when the client says verified: true, with the settings defaults', async () => {
    const base = await startMock();
    const kim = await account(base, 'kim@example.com', 'kim_v', 'volunteer', { verified: true });
    expect(kim.profile.status).toBe(201);
    expect(kim.profile.body).toMatchObject({
      verified: false, availability: 'free', notification_prefs: { volunteer: true, chat: true, venue: true, reports: true },
    });
    expect(typeof kim.profile.body.availability_updated_at).toBe('string');
    const patch = await call(base, 'PATCH', `/rest/v1/profiles?id=eq.${kim.id}`, { verified: true }, kim.token, ONE);
    expect(patch.status).toBe(403);
  });

  it('refuses Accept until the verify hook verifies the volunteer', async () => {
    const base = await startMock();
    const kim = await account(base, 'kim@example.com', 'kim_v', 'volunteer');
    const rosa = await account(base, 'rosa@example.com', 'rosa_m', 'visitor');
    const req = await call(base, 'POST', '/rest/v1/help_requests', { visitor_name: 'Rosa', venue_id: 'sofi', help_types: ['directions'], language: 'es' }, rosa.token, ONE);
    const id = req.body.id;
    const open = await call(base, 'POST', '/rest/v1/rpc/open_help_requests', {}, kim.token);
    expect(open.body.map((r: { id: string }) => r.id)).toEqual([id]);

    const refused = await call(base, 'POST', '/rest/v1/rpc/accept_help_request', { p_request_id: id }, kim.token);
    expect(refused).toMatchObject({ status: 403, body: { code: '42501', message: 'not_verified' } });

    expect((await call(base, 'POST', '/__control', { verify: 'nobody' })).status).toBe(404);
    expect((await call(base, 'POST', '/__control', { verify: 'KIM_V' })).status).toBe(200);
    const accepted = await call(base, 'POST', '/rest/v1/rpc/accept_help_request', { p_request_id: id }, kim.token);
    expect(accepted).toMatchObject({ status: 200, body: { status: 'matched', volunteer_id: kim.id } });

    // By email, and back to unverified.
    await call(base, 'POST', '/__control', { verify: 'kim@example.com', verified: false });
    const state = await call(base, 'GET', '/__state');
    expect(state.body.profiles.find((p: { id: string }) => p.id === kim.id).verified).toBe(false);
  });

  it('lets the owner change availability and notification prefs, only to valid values', async () => {
    const base = await startMock();
    const kim = await account(base, 'kim@example.com', 'kim_v', 'volunteer');
    const path = `/rest/v1/profiles?id=eq.${kim.id}&select=*`;
    const before = kim.profile.body.availability_updated_at;
    await new Promise(r => setTimeout(r, 5));
    const busy = await call(base, 'PATCH', path, { availability: 'busy' }, kim.token, ONE);
    expect(busy.body.availability).toBe('busy');
    expect(busy.body.availability_updated_at > before).toBe(true);
    const prefs = await call(base, 'PATCH', path, { notification_prefs: { volunteer: true, chat: false, venue: true, reports: true } }, kim.token, ONE);
    expect(prefs.body).toMatchObject({ availability: 'busy', notification_prefs: { chat: false } });
    expect(prefs.body.availability_updated_at).toBe(busy.body.availability_updated_at);

    expect((await call(base, 'PATCH', path, { availability: 'away' }, kim.token, ONE)).status).toBe(400);
    expect((await call(base, 'PATCH', path, { notification_prefs: { sms: true } }, kim.token, ONE)).status).toBe(400);
    expect((await call(base, 'PATCH', path, { notification_prefs: { chat: 'no' } }, kim.token, ONE)).status).toBe(400);
    expect((await call(base, 'PATCH', path, { availability_updated_at: '2000-01-01' }, kim.token, ONE)).status).toBe(403);
    // Someone else's row: nothing to update.
    const rosa = await account(base, 'rosa@example.com', 'rosa_m', 'visitor');
    expect((await call(base, 'PATCH', `/rest/v1/profiles?id=eq.${kim.id}`, { availability: 'off' }, rosa.token)).body).toEqual([]);
  });

  it('loads volunteers saved before verification existed as verified (the demo keeps working)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'venu-mock-'));
    const stateFile = join(dir, 'mock-supabase.json');
    const old = { id: 'u-sam', role: 'volunteer', first_name: 'Sam', languages: ['en'], main_language: 'en', verified: false, created_at: '2026-11-16T00:00:00Z' };
    const visitor = { ...old, id: 'u-rosa', role: 'visitor', first_name: 'Rosa' };
    writeFileSync(stateFile, JSON.stringify({ users: [], profiles: [old, visitor], files: {}, refreshTokens: {} }));
    const base = await startMock(stateFile);
    const { body } = await call(base, 'GET', '/__state');
    const sam = body.profiles.find((p: { id: string }) => p.id === 'u-sam');
    expect(sam).toMatchObject({ verified: true, availability: 'free', notification_prefs: { volunteer: true } });
    expect(body.profiles.find((p: { id: string }) => p.id === 'u-rosa').verified).toBe(false);

    // Saved again with the marker, so a volunteer un-verified later stays that way across restarts.
    await call(base, 'POST', '/__control', { verify: 'nobody' }); // no write
    await call(base, 'POST', '/auth/v1/signup', { email: 'x@example.com', password: 'longenough' }); // writes the file
    expect(JSON.parse(readFileSync(stateFile, 'utf8')).verifiedRule).toBe(1);
  });
});
