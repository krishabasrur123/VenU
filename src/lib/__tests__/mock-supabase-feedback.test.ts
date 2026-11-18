/**
 * @jest-environment node
 */
// scripts/mock-supabase.mjs mirrors supabase/migrations/20261118010000_reports_feedback.sql:
// facility_reports (everyone signed in reads, authors add and delete their own, the name comes from
// the profile), help_feedback (parties only, one rating each, problem reports write-only) and
// app_feedback (insert only); and 20261118050000_review_fixes.sql: author_id isn't readable (the
// facility_report_cards view says `mine` instead), and only help a volunteer took can be rated. Runs the real mock in a child process and talks HTTP to it.
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { spawn, type ChildProcess } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { join } from 'node:path';

const SCRIPT = join(__dirname, '..', '..', '..', 'scripts', 'mock-supabase.mjs');

let mock: ChildProcess;
let base = '';

beforeAll(async () => {
  mock = spawn(process.execPath, [SCRIPT, '0'], { stdio: ['ignore', 'pipe', 'pipe'] });
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

type Reply = { status: number; body: unknown };
function call(method: string, path: string, { token, body, headers = {} }: { token?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const all: Record<string, string> = { 'content-type': 'application/json', ...headers };
    if (token) all.authorization = `Bearer ${token}`;
    const req = httpRequest(`${base}${path}`, { method, headers: all }, res => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: text ? JSON.parse(text) : null }));
    });
    req.on('error', reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
const RETURN = { prefer: 'return=representation', accept: 'application/vnd.pgrst.object+json' };
/** facility_reports' readable columns (all but author_id), as report-db.ts asks for them. */
const COLUMNS = 'id,venue_id,facility_id,author_name,title,topic,body,language,created_at';

async function account(email: string, role: 'visitor' | 'volunteer', first_name: string) {
  const { body } = await call('POST', '/auth/v1/signup', { body: { email, password: 'longenough' } });
  const { access_token: token, user } = body as { access_token: string; user: { id: string } };
  const profile = await call('POST', '/rest/v1/profiles', {
    token,
    body: { id: user.id, role, first_name, languages: ['en'], main_language: 'en', trainings: [] },
  });
  expect(profile.status).toBe(201);
  return { token, id: user.id };
}

describe('mock facility_reports, help_feedback and app_feedback', () => {
  let rosa: { token: string; id: string };
  let sam: { token: string; id: string };
  let lee: { token: string; id: string };

  beforeAll(async () => {
    rosa = await account('rosa@example.com', 'visitor', 'Rosa');
    sam = await account('sam@example.com', 'volunteer', 'Sam');
    // Volunteers start unverified (only verified ones can accept); LA28 staff verify them.
    expect((await call('POST', '/__control', { body: { verify: 'sam@example.com' } })).status).toBe(200);
    lee = await account('lee@example.com', 'visitor', 'Lee');
  });

  it('facility reports: saved as yourself with your first name, read by others, deleted only by you', async () => {
    const report = { venue_id: 'sofi', facility_id: 'entry-4', title: 'Ramp is cracked', topic: 'accessibility', body: '', language: 'en' };
    expect((await call('POST', '/rest/v1/facility_reports', { body: report })).status).toBe(403); // signed out
    expect((await call('POST', '/rest/v1/facility_reports', { token: rosa.token, body: { ...report, author_name: 'Someone' } })).status).toBe(403);
    expect((await call('POST', '/rest/v1/facility_reports', { token: rosa.token, body: { ...report, topic: 'nope' } })).status).toBe(400);

    // Reading back select=* would include author_id: refused, and nothing is saved.
    expect((await call('POST', '/rest/v1/facility_reports?select=*', { token: rosa.token, body: report, headers: RETURN })).status).toBe(403);
    const saved = await call('POST', `/rest/v1/facility_reports?select=${COLUMNS}`, { token: rosa.token, body: report, headers: RETURN });
    expect(saved.status).toBe(201);
    const row = saved.body as { id: string; author_name: string };
    expect(row).toMatchObject({ ...report, author_name: 'Rosa' });
    expect(row).not.toHaveProperty('author_id');

    const seen = await call('GET', `/rest/v1/facility_reports?select=${COLUMNS}&venue_id=eq.sofi&facility_id=eq.entry-4&order=created_at.desc`, { token: lee.token });
    expect((seen.body as { id: string }[]).map(r => r.id)).toEqual([row.id]);
    expect((await call('GET', `/rest/v1/facility_reports?select=${COLUMNS}&venue_id=eq.sofi`, {})).status).toBe(403);

    await call('DELETE', `/rest/v1/facility_reports?id=eq.${row.id}`, { token: lee.token });
    expect(((await call('GET', `/rest/v1/facility_reports?select=id`, { token: rosa.token })).body as unknown[]).length).toBe(1);
    await call('DELETE', `/rest/v1/facility_reports?id=eq.${row.id}`, { token: rosa.token });
    expect((await call('GET', `/rest/v1/facility_reports?select=id`, { token: rosa.token })).body).toEqual([]);
  });

  it("facility reports: nobody reads who wrote one; the cards say which are yours", async () => {
    const report = { venue_id: 'sofi', facility_id: 'entry-3', title: 'Lift is slow', topic: 'accessibility', body: '', language: 'en' };
    const saved = await call('POST', `/rest/v1/facility_reports?select=${COLUMNS}`, { token: rosa.token, body: report, headers: RETURN });
    const id = (saved.body as { id: string }).id;
    for (const query of ['select=*', 'select=id,author_id', `select=id&author_id=eq.${rosa.id}`, '']) {
      expect([query, (await call('GET', `/rest/v1/facility_reports?${query}`, { token: lee.token })).status]).toEqual([query, 403]);
    }
    expect((await call('DELETE', `/rest/v1/facility_reports?author_id=eq.${rosa.id}`, { token: lee.token })).status).toBe(403);

    const cards = async (token: string) =>
      (await call('GET', `/rest/v1/facility_report_cards?select=${COLUMNS},mine&venue_id=eq.sofi&facility_id=eq.entry-3`, { token })).body as Record<string, unknown>[];
    const rosaSees = await cards(rosa.token);
    expect(rosaSees).toEqual([expect.objectContaining({ id, title: 'Lift is slow', author_name: 'Rosa', mine: true })]);
    expect(rosaSees[0]).not.toHaveProperty('author_id');
    expect(await cards(lee.token)).toEqual([expect.objectContaining({ id, mine: false })]);
    expect((await call('GET', '/rest/v1/facility_report_cards?select=id,author_id', { token: lee.token })).status).toBe(403);
    expect((await call('GET', '/rest/v1/facility_report_cards?select=*', {})).status).toBe(403);
    expect((await call('DELETE', `/rest/v1/facility_report_cards?id=eq.${id}`, { token: rosa.token })).status).toBe(403);
    await call('DELETE', `/rest/v1/facility_reports?id=eq.${id}`, { token: rosa.token });
    expect(await cards(rosa.token)).toEqual([]);
  });

  it('help feedback: a request nobody took cannot be marked done, rated or reported', async () => {
    const id = '22222222-2222-4222-8222-222222222222';
    await call('POST', '/rest/v1/help_requests', {
      token: rosa.token, body: { id, visitor_name: 'Rosa', venue_id: 'sofi', spot: 'entry-4', help_types: ['directions'], note: '', language: 'es' },
    });
    await call('POST', '/rest/v1/rpc/close_help_request', { token: rosa.token, body: { p_request_id: id, p_status: 'done' } });
    const state = (await call('GET', '/__help')).body as { requests: { id: string; status: string }[] };
    expect(state.requests.find(r => r.id === id)?.status).toBe('cancelled');
    const rating = { request_id: id, kind: 'rating', stars: 5, tags: [], problem: null, note: '' };
    expect((await call('POST', '/rest/v1/help_feedback', { token: rosa.token, body: rating })).status).toBe(403);
    const problem = { request_id: id, kind: 'problem', stars: null, tags: [], problem: 'no_show', note: '' };
    expect((await call('POST', '/rest/v1/help_feedback', { token: rosa.token, body: problem })).status).toBe(403);
  });

  it('help feedback: parties of a taken request rate once; problem reports stay write-only', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const opened = await call('POST', '/rest/v1/help_requests', {
      token: rosa.token, body: { id, visitor_name: 'Rosa', venue_id: 'sofi', spot: 'entry-4', help_types: ['directions'], note: '', language: 'es' },
    });
    expect(opened.status).toBe(201);
    const rating = { request_id: id, kind: 'rating', stars: 5, tags: ['patient'], problem: null, note: 'Thanks' };
    expect((await call('POST', '/rest/v1/help_feedback', { token: rosa.token, body: rating })).status).toBe(403); // still open

    expect((await call('POST', '/rest/v1/rpc/accept_help_request', { token: sam.token, body: { p_request_id: id } })).status).toBe(200);
    await call('POST', '/rest/v1/rpc/close_help_request', { token: rosa.token, body: { p_request_id: id, p_status: 'done' } });

    expect((await call('POST', '/rest/v1/help_feedback', { token: lee.token, body: rating })).status).toBe(403); // not a party
    expect((await call('POST', '/rest/v1/help_feedback', { token: rosa.token, body: rating })).status).toBe(201);
    const again = await call('POST', '/rest/v1/help_feedback', { token: rosa.token, body: { ...rating, stars: 1 } });
    expect(again).toMatchObject({ status: 409, body: { code: '23505' } });
    expect((await call('POST', '/rest/v1/help_feedback', { token: rosa.token, body: { ...rating, stars: 7 } })).status).toBe(400);

    const problem = { request_id: id, kind: 'problem', stars: null, tags: [], problem: 'no_show', note: 'Never came' };
    expect((await call('POST', '/rest/v1/help_feedback', { token: rosa.token, body: problem })).status).toBe(201);

    // The volunteer reads the rating about them, never the problem report; nor does its author.
    const samSees = (await call('GET', '/rest/v1/help_feedback', { token: sam.token })).body as { kind: string; stars: number }[];
    expect(samSees.map(f => [f.kind, f.stars])).toEqual([['rating', 5]]);
    const rosaSees = (await call('GET', '/rest/v1/help_feedback', { token: rosa.token })).body as { kind: string }[];
    expect(rosaSees.map(f => f.kind)).toEqual(['rating']);
    expect((await call('GET', '/rest/v1/help_feedback', { token: lee.token })).body).toEqual([]);

    const state = (await call('GET', '/__state')).body as { help_feedback: { kind: string; author_id: string }[] };
    expect(state.help_feedback.map(f => [f.kind, f.author_id])).toEqual([['rating', rosa.id], ['problem', rosa.id]]);
  });

  it('app feedback: insert only, as yourself', async () => {
    const note = { note: 'The map was hard to read', language: 'en', platform: 'web' };
    expect((await call('POST', '/rest/v1/app_feedback', { body: note })).status).toBe(403);
    expect((await call('POST', '/rest/v1/app_feedback', { token: rosa.token, body: { ...note, note: '  ' } })).status).toBe(400);
    expect((await call('POST', '/rest/v1/app_feedback', { token: rosa.token, body: note })).status).toBe(201);
    expect((await call('GET', '/rest/v1/app_feedback', { token: rosa.token })).status).toBe(403);
    const state = (await call('GET', '/__state')).body as { app_feedback: { author_id: string; note: string }[] };
    expect(state.app_feedback).toEqual([expect.objectContaining({ author_id: rosa.id, note: note.note })]);
  });
});
