/**
 * @jest-environment node
 */
// scripts/mock-supabase.mjs mirrors 20261118040000_help_flow_fixes.sql: withdraw_open_request cancels
// only a request that's still open, answers with the row either way (so a visitor whose search timed
// out after a volunteer accepted gets the match), refuses other people's requests and anon callers.
// Also checks release_help_request reopens a request for the next volunteer ("Can't make it").
// Runs the real mock in a child process and talks HTTP to it (node:http: jest-expo swaps the global
// fetch for Expo's).
import { afterAll, describe, expect, it } from '@jest/globals';
import { spawn, type ChildProcess } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const SCRIPT = join(__dirname, '..', '..', '..', 'scripts', 'mock-supabase.mjs');
const running: ChildProcess[] = [];

/** Starts a mock on a free port; resolves with its base URL. */
function startMock(): Promise<string> {
  const code = `import { startMockSupabase } from ${JSON.stringify(pathToFileURL(SCRIPT).href)};
    const server = await startMockSupabase({ port: 0, log: () => {} });
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

async function account(base: string, username: string, role: 'visitor' | 'volunteer') {
  const { body: session } = await call(base, 'POST', '/auth/v1/signup', { email: `${username}@example.com`, password: 'longenough', data: { username } });
  const token: string = session.access_token;
  const id: string = session.user.id;
  await call(base, 'POST', '/rest/v1/profiles?select=*', {
    id, role, first_name: username, languages: ['en'], main_language: 'en', app_language: 'en',
    gender: role === 'volunteer' ? 'woman' : null, age_band: role === 'volunteer' ? 'under_40' : null,
    trainings: [], privacy_version: 'v1', privacy_accepted_at: new Date().toISOString(),
  }, token, ONE);
  if (role === 'volunteer') await call(base, 'POST', '/__control', { verify: username });
  return { id, token };
}

async function people(base: string) {
  return { rosa: await account(base, 'rosa_m', 'visitor'), sam: await account(base, 'sam_helps', 'volunteer'), ana: await account(base, 'ana_v', 'volunteer') };
}

async function ask(base: string, token: string): Promise<string> {
  const req = await call(base, 'POST', '/rest/v1/help_requests', { visitor_name: 'Rosa', venue_id: 'sofi', help_types: ['directions'], language: 'es' }, token, ONE);
  return req.body.id;
}

const withdraw = (base: string, id: string, token?: string) => call(base, 'POST', '/rest/v1/rpc/withdraw_open_request', { p_request_id: id }, token);

describe('mock withdraw_open_request', () => {
  it('withdraws an open request and answers with it, cancelled by the visitor', async () => {
    const base = await startMock();
    const { rosa, sam } = await people(base);
    const id = await ask(base, rosa.token);

    const res = await withdraw(base, id, rosa.token);
    expect(res).toMatchObject({ status: 200, body: { id, status: 'cancelled', closed_by: rosa.id } });
    // Gone from the open list, and a late Accept is told it was withdrawn.
    expect((await call(base, 'POST', '/rest/v1/rpc/open_help_requests', {}, sam.token)).body).toEqual([]);
    const late = await call(base, 'POST', '/rest/v1/rpc/accept_help_request', { p_request_id: id }, sam.token);
    expect(late).toMatchObject({ status: 400, body: { message: 'request_closed' } });
  });

  it('leaves a request a volunteer already accepted alone and answers with the match', async () => {
    const base = await startMock();
    const { rosa, sam } = await people(base);
    const id = await ask(base, rosa.token);
    expect((await call(base, 'POST', '/rest/v1/rpc/accept_help_request', { p_request_id: id }, sam.token)).status).toBe(200);

    // The visitor's 2-minute timer fires late, after the Accept.
    const res = await withdraw(base, id, rosa.token);
    expect(res).toMatchObject({ status: 200, body: { id, status: 'matched', volunteer_id: sam.id, volunteer_name: 'sam_helps', closed_by: null } });
    const help = await call(base, 'GET', '/__help');
    expect(help.body.requests.find((r: { id: string }) => r.id === id).status).toBe('matched');

    // The visitor's own Cancel still calls off the matched volunteer.
    await call(base, 'POST', '/rest/v1/rpc/close_help_request', { p_request_id: id, p_status: 'cancelled' }, rosa.token);
    const after = await call(base, 'GET', `/rest/v1/help_requests?id=eq.${id}`, undefined, rosa.token);
    expect(after.body[0]).toMatchObject({ status: 'cancelled', closed_by: rosa.id });
  });

  it('answers null for a request that is not the caller’s and changes nothing; refuses anon', async () => {
    const base = await startMock();
    const { rosa, sam } = await people(base);
    const id = await ask(base, rosa.token);

    expect(await withdraw(base, id, sam.token)).toEqual({ status: 200, body: null });
    expect(await withdraw(base, '00000000-0000-4000-8000-000000000000', rosa.token)).toEqual({ status: 200, body: null });
    expect((await withdraw(base, id)).status).toBe(401);
    const help = await call(base, 'GET', '/__help');
    expect(help.body.requests.find((r: { id: string }) => r.id === id).status).toBe('open');
  });

  it('a done request comes back as it is', async () => {
    const base = await startMock();
    const { rosa, sam } = await people(base);
    const id = await ask(base, rosa.token);
    await call(base, 'POST', '/rest/v1/rpc/accept_help_request', { p_request_id: id }, sam.token);
    await call(base, 'POST', '/rest/v1/rpc/close_help_request', { p_request_id: id, p_status: 'done' }, rosa.token);
    expect((await withdraw(base, id, rosa.token)).body).toMatchObject({ status: 'done' });
  });
});

describe('mock release_help_request ("Can’t make it")', () => {
  it('reopens the request for the next volunteer, who can accept it', async () => {
    const base = await startMock();
    const { rosa, sam, ana } = await people(base);
    const id = await ask(base, rosa.token);
    await call(base, 'POST', '/rest/v1/rpc/accept_help_request', { p_request_id: id }, sam.token);

    expect((await call(base, 'POST', '/rest/v1/rpc/release_help_request', { p_request_id: id }, sam.token)).status).toBe(204);
    const seen = await call(base, 'GET', `/rest/v1/help_requests?id=eq.${id}`, undefined, rosa.token);
    expect(seen.body[0]).toMatchObject({ status: 'open', volunteer_id: null, volunteer_name: null, matched_at: null });
    expect((await call(base, 'POST', '/rest/v1/rpc/open_help_requests', {}, ana.token)).body.map((r: { id: string }) => r.id)).toEqual([id]);
    const taken = await call(base, 'POST', '/rest/v1/rpc/accept_help_request', { p_request_id: id }, ana.token);
    expect(taken).toMatchObject({ status: 200, body: { status: 'matched', volunteer_id: ana.id } });
  });
});
