/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';

import { formatResult, parseAccount, parseE2eArgs, runSteps, summarize, waitFor, type Step } from '../e2e-lib.ts';

const BASE = ['--url', 'http://localhost:47330/', '--anon', 'mock-publishable-key'];

describe('parseE2eArgs', () => {
  it('reads --signup and trims the URL', () => {
    const out = parseE2eArgs([...BASE, '--signup']);
    expect(out).toEqual({ ok: true, options: { url: 'http://localhost:47330', anon: 'mock-publishable-key', visitor: null, volunteer: null, signup: true, waitMs: 10_000, emailDomain: 'example.com' } });
  });

  it('reads two accounts, from flags or from E2E_VISITOR / E2E_VOLUNTEER', () => {
    const flags = parseE2eArgs([...BASE, '--visitor', 'rosa_m:pw:with:colons', '--volunteer', 'sam@example.com:pw2', '--wait', '3']);
    expect(flags.ok && flags.options).toMatchObject({
      visitor: { login: 'rosa_m', password: 'pw:with:colons' }, volunteer: { login: 'sam@example.com', password: 'pw2' }, signup: false, waitMs: 3000,
    });
    const env = parseE2eArgs(BASE, { E2E_VISITOR: 'a_b:x', E2E_VOLUNTEER: 'c_d:y' });
    expect(env.ok && env.options.visitor).toEqual({ login: 'a_b', password: 'x' });
  });

  it('refuses to run without accounts or --signup, so it never creates accounts by accident', () => {
    expect(parseE2eArgs(BASE)).toEqual({ ok: false, error: expect.stringMatching(/--signup/) });
    expect(parseE2eArgs([...BASE, '--signup', '--visitor', 'a:b'])).toEqual({ ok: false, error: expect.stringMatching(/not both/) });
  });

  it('explains bad input', () => {
    expect(parseE2eArgs(['--anon', 'k', '--signup'])).toMatchObject({ ok: false, error: expect.stringMatching(/--url/) });
    expect(parseE2eArgs(['--url', 'http://x', '--signup'])).toMatchObject({ ok: false, error: expect.stringMatching(/--anon/) });
    expect(parseE2eArgs([...BASE, '--visitor', 'nopassword', '--volunteer', 'a:b'])).toMatchObject({ ok: false, error: expect.stringMatching(/user:pass/) });
    expect(parseE2eArgs([...BASE, '--signup', '--wait', '0'])).toMatchObject({ ok: false, error: expect.stringMatching(/--wait/) });
    expect(parseE2eArgs([...BASE, '--signup', '--bogus'])).toMatchObject({ ok: false, error: 'Unknown argument --bogus.' });
    expect(parseE2eArgs([...BASE, '--url'])).toMatchObject({ ok: false, error: '--url needs a value.' });
    expect(parseE2eArgs(['--help'])).toEqual({ ok: false, error: '' });
  });
});

describe('parseAccount', () => {
  it('splits at the first colon', () => {
    expect(parseAccount('u:p')).toEqual({ login: 'u', password: 'p' });
    expect(parseAccount(':p')).toBeNull();
    expect(parseAccount('u:')).toBeNull();
    expect(parseAccount(undefined)).toBeNull();
  });
});

describe('runSteps', () => {
  interface Ctx { a?: number; b?: number; log: string[] }

  it('passes, fails, skips on missing context, prints TODO stubs, and still runs cleanup', async () => {
    const steps: Step<Ctx>[] = [
      { id: 'one', async run(c) { c.a = 1; return 'note'; } },
      { id: 'two', needs: ['a'], async run() { throw new Error('boom'); } },
      { id: 'three', needs: ['b'], async run(c) { c.log.push('three ran'); } },
      { id: 'four', async run() { return { skip: 'no realtime' }; } },
      { id: 'five', todo: 'ratings not built', async run(c) { c.log.push('five ran'); } },
      { id: 'cleanup', needs: ['b'], always: true, async run(c) { c.log.push('cleanup ran'); } },
    ];
    const ctx: Ctx = { log: [] };
    const lines: string[] = [];
    let t = 0;
    const results = await runSteps(steps, ctx, l => lines.push(l), () => (t += 5));
    expect(results.map(r => [r.id, r.status, r.note])).toEqual([
      ['one', 'PASS', 'note'],
      ['two', 'FAIL', 'boom'],
      ['three', 'SKIP', 'needs b from an earlier step'],
      ['four', 'SKIP', 'no realtime'],
      ['five', 'SKIP', 'TODO: ratings not built'],
      ['cleanup', 'PASS', ''],
    ]);
    expect(ctx.log).toEqual(['cleanup ran']);
    expect(lines[0]).toBe('PASS  one  (5 ms)  note');
    expect(lines[2]).toBe('SKIP  three  needs b from an earlier step');
    expect(summarize(results)).toEqual({ line: 'PASS 2 · FAIL 1 · SKIP 3', exitCode: 1 });
    expect(summarize(results.filter(r => r.status !== 'FAIL')).exitCode).toBe(0);
  });

  it('formats a line without a note', () => {
    expect(formatResult({ id: 'x', status: 'FAIL', note: '', ms: 12 })).toBe('FAIL  x  (12 ms)');
  });
});

describe('waitFor', () => {
  it('returns the first value, or null after the time runs out', async () => {
    let n = 0;
    expect(await waitFor(async () => (++n >= 3 ? 'ok' : null), 1000, 1)).toBe('ok');
    expect(await waitFor(async () => null, 20, 5)).toBeNull();
  });
});
