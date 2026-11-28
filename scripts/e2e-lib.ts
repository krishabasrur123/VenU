// The parts of scripts/e2e.mjs that don't talk to a backend: argument parsing and the step runner.
// Plain TypeScript with erasable types and no imports, so Node's type stripping loads it as is.

export interface Account {
  /** A username (signs in through the username-sign-in function) or an email. */
  login: string;
  password: string;
}

export interface E2eOptions {
  url: string;
  anon: string;
  visitor: Account | null;
  volunteer: Account | null;
  /** Create two fresh accounts (and their profiles) instead of signing in to existing ones. */
  signup: boolean;
  /** How long to wait for a realtime event or a polled row, in ms. */
  waitMs: number;
  /** Domain for --signup emails. */
  emailDomain: string;
}

export const USAGE = `Usage: node scripts/e2e.mjs --url <supabase url> --anon <publishable key> (--visitor user:pass --volunteer user:pass | --signup)
  --visitor / --volunteer   existing accounts, username or email; or set E2E_VISITOR / E2E_VOLUNTEER instead
  --signup                  create two new accounts and profiles (the only way this script creates accounts)
  --wait <seconds>          how long to wait for a realtime event or a row (default 10)
  --email-domain <domain>   domain for --signup emails (default example.com)
Examples:
  node scripts/e2e.mjs --url http://localhost:47330 --anon mock-publishable-key --signup
  node scripts/e2e.mjs --url https://<ref>.supabase.co --anon sb_publishable_... --visitor rosa_m:pw --volunteer sam_helps:pw`;

/** 'rosa_m:secret:with:colons' → { login: 'rosa_m', password: 'secret:with:colons' }; null when malformed. */
export function parseAccount(raw: string | undefined): Account | null {
  if (!raw) return null;
  const at = raw.indexOf(':');
  if (at <= 0 || at === raw.length - 1) return null;
  return { login: raw.slice(0, at).trim(), password: raw.slice(at + 1) };
}

export type ParsedArgs = { ok: true; options: E2eOptions } | { ok: false; error: string };

/** argv after the script name; `env` supplies E2E_VISITOR / E2E_VOLUNTEER so passwords can stay out of shell history. */
export function parseE2eArgs(argv: string[], env: Record<string, string | undefined> = {}): ParsedArgs {
  const values: Record<string, string> = {};
  let signup = false;
  const valued = new Set(['--url', '--anon', '--visitor', '--volunteer', '--wait', '--email-domain']);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--signup') signup = true;
    else if (arg === '--help' || arg === '-h') return { ok: false, error: '' };
    else if (valued.has(arg)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) return { ok: false, error: `${arg} needs a value.` };
      values[arg] = value;
      i += 1;
    } else return { ok: false, error: `Unknown argument ${arg}.` };
  }
  const url = values['--url']?.replace(/\/+$/, '');
  const anon = values['--anon'];
  if (!url || !/^https?:\/\//.test(url)) return { ok: false, error: '--url must be the project URL, e.g. https://<ref>.supabase.co.' };
  if (!anon) return { ok: false, error: '--anon must be the publishable (anon) key.' };

  const visitorRaw = values['--visitor'] ?? env.E2E_VISITOR;
  const volunteerRaw = values['--volunteer'] ?? env.E2E_VOLUNTEER;
  const visitor = parseAccount(visitorRaw);
  const volunteer = parseAccount(volunteerRaw);
  if (signup && (values['--visitor'] || values['--volunteer'])) return { ok: false, error: 'Use --signup or --visitor/--volunteer, not both.' };
  if (!signup) {
    if (!visitorRaw || !volunteerRaw) return { ok: false, error: 'Pass --visitor and --volunteer (user:pass), or --signup to create two accounts.' };
    if (!visitor || !volunteer) return { ok: false, error: 'Accounts look like user:pass, e.g. rosa_m:secret.' };
  }

  const wait = values['--wait'] === undefined ? 10 : Number(values['--wait']);
  if (!Number.isFinite(wait) || wait <= 0 || wait > 120) return { ok: false, error: '--wait must be a number of seconds between 1 and 120.' };
  const emailDomain = values['--email-domain'] ?? 'example.com';
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(emailDomain)) return { ok: false, error: '--email-domain must be a domain such as example.com.' };

  return {
    ok: true,
    options: { url, anon, visitor: signup ? null : visitor, volunteer: signup ? null : volunteer, signup, waitMs: wait * 1000, emailDomain },
  };
}

// ---- steps

export type StepStatus = 'PASS' | 'FAIL' | 'SKIP';

/** What a step's run() may return: nothing (PASS), a note for the PASS line, or an explicit skip. */
export type StepReturn = void | string | { skip: string };

export interface Step<C> {
  id: string;
  /** Context keys earlier steps must have set; missing ones skip this step. */
  needs?: (keyof C & string)[];
  /** Not built yet: always prints SKIP with this reason. Fill in run() and drop `todo` when the feature lands. */
  todo?: string;
  /** Runs even after failures (cleanup). */
  always?: boolean;
  run(ctx: C): Promise<StepReturn>;
}

export interface StepResult {
  id: string;
  status: StepStatus;
  note: string;
  ms: number;
}

/** One line per step: 'PASS  sign-in-visitor  (412 ms)  rosa_m'. */
export function formatResult(r: StepResult): string {
  const time = r.status === 'SKIP' ? '' : `  (${r.ms} ms)`;
  return `${r.status}  ${r.id}${time}${r.note ? `  ${r.note}` : ''}`;
}

/** Runs the steps in order and reports each through `print` as it finishes. */
export async function runSteps<C extends object>(steps: Step<C>[], ctx: C, print: (line: string) => void = console.log, now: () => number = Date.now): Promise<StepResult[]> {
  const results: StepResult[] = [];
  const record = (r: StepResult) => { results.push(r); print(formatResult(r)); };
  for (const step of steps) {
    if (step.todo) { record({ id: step.id, status: 'SKIP', note: `TODO: ${step.todo}`, ms: 0 }); continue; }
    const missing = (step.needs ?? []).filter(k => (ctx as Record<string, unknown>)[k] == null);
    if (missing.length && !step.always) {
      record({ id: step.id, status: 'SKIP', note: `needs ${missing.join(', ')} from an earlier step`, ms: 0 });
      continue;
    }
    const start = now();
    try {
      const out = await step.run(ctx);
      const ms = now() - start;
      if (out && typeof out === 'object') record({ id: step.id, status: 'SKIP', note: out.skip, ms });
      else record({ id: step.id, status: 'PASS', note: out ?? '', ms });
    } catch (e) {
      record({ id: step.id, status: 'FAIL', note: e instanceof Error ? e.message : String(e), ms: now() - start });
    }
  }
  return results;
}

/** 'PASS 12 · FAIL 1 · SKIP 4', and the exit code: 1 when anything failed. */
export function summarize(results: StepResult[]): { line: string; exitCode: number } {
  const count = (s: StepStatus) => results.filter(r => r.status === s).length;
  return { line: `PASS ${count('PASS')} · FAIL ${count('FAIL')} · SKIP ${count('SKIP')}`, exitCode: count('FAIL') ? 1 : 0 };
}

/** Polls `check` until it returns a value (not null/undefined) or `ms` passes; null on timeout. */
export async function waitFor<T>(check: () => Promise<T | null | undefined>, ms: number, everyMs = 500): Promise<T | null> {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value != null) return value;
    if (Date.now() >= end) return null;
    await new Promise(r => setTimeout(r, everyMs));
  }
}
