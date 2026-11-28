/**
 * @jest-environment node
 */
// scripts/mock-supabase.mjs mirrors the username rules in supabase/migrations, including
// 20261116120000_free_unconfirmed_usernames.sql: a name an unconfirmed sign-up has held for over
// an hour is free, and that account gets it back on a late confirm only if nobody took it.
// Runs the real mock (with email confirmation on) in a child process and talks HTTP to it
// (node:http: jest-expo swaps the global fetch for Expo's).
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { spawn, type ChildProcess } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { join } from 'node:path';

const SCRIPT = join(__dirname, '..', '..', '..', 'scripts', 'mock-supabase.mjs');
const HOUR = 60 * 60 * 1000;

let mock: ChildProcess;
let base = '';

beforeAll(async () => {
  // --stub-translate: never a real translate provider, even in a checkout whose .env.local has keys.
  mock = spawn(process.execPath, [SCRIPT, '0', '--confirm-email', '--stub-translate'], { stdio: ['ignore', 'pipe', 'pipe'] });
  base = await new Promise<string>((resolve, reject) => {
    let out = '';
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

function call(method: string, path: string, body?: unknown): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(`${base}${path}`, { method, headers: { 'content-type': 'application/json' } }, res => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, text }));
    });
    req.on('error', reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
async function post(path: string, body: unknown) {
  const { status, text } = await call('POST', path, body);
  return { status, body: JSON.parse(text) };
}
const signUp = (email: string, username: string) => post('/auth/v1/signup', { email, password: 'longenough', data: { username } });
const available = async (name: string) => (await post('/rest/v1/rpc/username_available', { p_username: name })).body;
// Who holds a name, as email_for_username would answer it server-side (the RPC itself is service
// role only, 20261117000000_private_username_lookup.sql).
async function emailFor(name: string) {
  const state = JSON.parse((await call('GET', '/__state')).text);
  return state.users.find((u: { username?: string }) => u.username === name.toLowerCase())?.email ?? null;
}
const confirm = (email: string) => call('GET', `/__confirm?email=${encodeURIComponent(email)}`);
const clock = (ms: number) => post('/__control', { clockOffsetMs: ms });
async function usernameOf(email: string) {
  const state = JSON.parse((await call('GET', '/__state')).text);
  return state.users.find((u: { email: string }) => u.email === email)?.username ?? null;
}

describe('mock usernames held by unconfirmed sign-ups', () => {
  it('holds the name for an hour, then lets a new sign-up take it', async () => {
    await clock(0);
    expect((await signUp('dan@typo.com', 'daniel_k')).status).toBe(200);
    expect(await available('daniel_k')).toBe(false);

    await clock(10 * 60 * 1000); // 10 minutes later: still held
    expect(await available('daniel_k')).toBe(false);
    expect((await signUp('dan2@x.com', 'daniel_k')).status).toBe(500);

    await clock(2 * HOUR); // two hours later: free
    expect(await available('Daniel_K')).toBe(true);
    expect((await signUp('dan@x.com', 'daniel_k')).status).toBe(200);
    expect(await emailFor('daniel_k')).toBe('dan@x.com');
    expect(await usernameOf('dan@typo.com')).toBeNull();
    expect(await available('daniel_k')).toBe(false); // the new account's hour just started

    // The old account confirms late: the name stays with the new one.
    await confirm('dan@typo.com');
    expect(await usernameOf('dan@typo.com')).toBeNull();
    expect(await emailFor('daniel_k')).toBe('dan@x.com');
  });

  it('never frees a confirmed account\'s name', async () => {
    await clock(0);
    await signUp('rosa@x.com', 'rosa_m');
    await confirm('rosa@x.com');
    await clock(5 * HOUR);
    expect(await available('rosa_m')).toBe(false);
    expect((await signUp('rosa2@x.com', 'rosa_m')).status).toBe(500);
  });

  it('keeps the name on a late confirm when nobody took it', async () => {
    await clock(0);
    await signUp('lee@x.com', 'lee_v');
    await clock(3 * HOUR);
    expect(await available('lee_v')).toBe(true);
    await confirm('lee@x.com');
    expect(await usernameOf('lee@x.com')).toBe('lee_v');
    expect(await available('lee_v')).toBe(false);
  });
});
