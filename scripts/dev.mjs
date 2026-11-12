// Starts the app in one of three backend modes, each on its own port so their data never mixes,
// and stops every VenU dev server with one command. Run through npm:
//
//   npm run dev:local          no backend: any email and password work, data stays on the device
//   npm run dev:mock           fake Supabase on this machine; sign-up signs you straight in
//   npm run dev:mock:verify    same, but sign-up asks you to confirm by email (link printed here)
//   npm run dev:supabase       your real Supabase project, from .env.local
//   npm run stop               end every VenU dev server, including ones started another way
//
// Extra flags go after `--`: `npm run dev:mock -- --reset` (wipe fake data), `-- --port 8090`,
// and anything else is passed to `expo start` (`-- --web`, `-- --clear`).
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOCK_SUPABASE_PORT, startMockSupabase } from './mock-supabase.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RUN_DIR = join(ROOT, '.expo', 'dev-servers'); // one file per running server (git-ignored)
const MOCK_STATE = join(ROOT, '.expo', 'mock-supabase.json');
const MOCK_API_PORT = MOCK_SUPABASE_PORT;
const PORTS = { supabase: 8081, local: 8082, mock: 8083 };

const [mode, ...rest] = process.argv.slice(2);
const flag = name => { const i = rest.indexOf(name); if (i === -1) return false; rest.splice(i, 1); return true; };
const option = name => { const i = rest.indexOf(name); if (i === -1) return null; const v = rest[i + 1]; rest.splice(i, 2); return v; };

if (mode === 'stop') {
  const stopped = stopAll();
  console.log(stopped.length ? `Stopped ${stopped.length} VenU dev server${stopped.length > 1 ? 's' : ''}: ${stopped.join(', ')}` : 'No VenU dev servers running.');
  process.exit(0);
}
if (!(mode in PORTS)) {
  console.error('Usage: node scripts/dev.mjs <local|mock|supabase|stop> [--verify] [--reset] [--port N] [expo args]');
  process.exit(1);
}

const verify = flag('--verify');
const reset = flag('--reset');
const port = Number(option('--port') ?? PORTS[mode]);
const env = { ...process.env };
const notes = [];

if (mode === 'local' || mode === 'mock') {
  env.EXPO_NO_DOTENV = '1'; // ignore .env.local, so these modes never touch the real project
  delete env.EXPO_PUBLIC_SUPABASE_URL;
  delete env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
}
if (mode === 'local') {
  notes.push('Backend:  none. Any email and password sign you in; data stays in this browser or device.');
}
if (mode === 'supabase') {
  const keys = readEnvLocal();
  const missing = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'].filter(k => !keys[k] || /your-project|your-anon/.test(keys[k]));
  if (missing.length) {
    console.error(`Set ${missing.join(' and ')} in .env.local first (copy .env.example; values are in Supabase -> Project Settings -> API Keys).`);
    console.error('No project yet? npm run dev:mock runs a fake one on this machine.');
    process.exit(1);
  }
  notes.push(`Backend:  ${keys.EXPO_PUBLIC_SUPABASE_URL}`);
  notes.push('Sign-up:  needs email confirmation if "Confirm email" is on in Supabase -> Authentication -> Sign In / Providers -> Email.');
}

await freePort(port);

let mockServer = null;
if (mode === 'mock') {
  if (reset) rmSync(MOCK_STATE, { force: true });
  await freePort(MOCK_API_PORT);
  mockServer = await startMockSupabase({ port: MOCK_API_PORT, confirmEmail: verify, stateFile: MOCK_STATE });
  env.EXPO_PUBLIC_SUPABASE_URL = `http://localhost:${MOCK_API_PORT}`;
  env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'mock-publishable-key';
  notes.push(`Backend:  fake Supabase at http://localhost:${MOCK_API_PORT}, saved in .expo/mock-supabase.json (-- --reset wipes it)`);
  notes.push(verify
    ? 'Sign-up:  asks you to confirm; the confirmation link prints here.'
    : 'Sign-up:  signs you straight in. npm run dev:mock:verify tests email confirmation.');
  notes.push('Devices:  web and simulators only; a phone can\'t reach "localhost" on this computer.');
}

console.log(`\nVenU · ${mode} mode`);
console.log(`App:      http://localhost:${port}  (press w below to open it)`);
for (const n of notes) console.log(n);
console.log('Stop:     Ctrl+C here, or npm run stop from any terminal.\n');

const expoCli = createRequire(import.meta.url).resolve('expo/bin/cli');
const expo = spawn(process.execPath, [expoCli, 'start', '--port', String(port), ...rest], { cwd: ROOT, env, stdio: 'inherit' });

mkdirSync(RUN_DIR, { recursive: true });
const runFile = join(RUN_DIR, `${process.pid}.json`);
writeFileSync(runFile, JSON.stringify({ pid: process.pid, mode, port, startedAt: new Date().toISOString() }));

function cleanup() {
  rmSync(runFile, { force: true });
  mockServer?.close();
}
// Ctrl+C reaches Expo too (same terminal); wait for it to finish, then exit.
process.on('SIGINT', () => {});
process.on('SIGTERM', () => { expo.kill('SIGTERM'); });
expo.on('exit', code => { cleanup(); process.exit(code ?? 0); });

// ---------------------------------------------------------------------------

function readEnvLocal() {
  const out = { ...process.env };
  for (const file of ['.env', '.env.local']) {
    const path = join(ROOT, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
  return out;
}

/** Resolves null when the port can be bound, otherwise the error code (EADDRINUSE, EACCES, ...). */
function portError(p) {
  return new Promise(done => {
    const probe = createServer();
    probe.once('error', e => done(e.code ?? 'UNKNOWN'));
    probe.listen(p, () => probe.close(() => done(null)));
  });
}

async function isPortFree(p) {
  return (await portError(p)) === null;
}

/** Frees the port if one of our own servers holds it; otherwise explains and exits. */
async function freePort(p) {
  const error = await portError(p);
  if (error === null) return;
  if (error === 'EACCES') {
    // Nothing is listening; the OS refuses the port (on Windows, a Hyper-V/WSL reserved range).
    console.error(`Port ${p} is blocked by the system, not used by a program.`);
    if (process.platform === 'win32') console.error('Reserved ranges: netsh interface ipv4 show excludedportrange protocol=tcp');
    console.error(p === MOCK_API_PORT
      ? 'Change MOCK_SUPABASE_PORT in scripts/mock-supabase.mjs to a port outside those ranges.'
      : 'Pick another port: -- --port <number>.');
    process.exit(1);
  }
  const ours = runningServers().filter(s => s.port === p || (s.mode === 'mock' && p === MOCK_API_PORT));
  if (ours.length) {
    for (const s of ours) killTree(s.pid);
    console.log(`Stopped the VenU ${ours.map(s => s.mode).join(', ')} server that was using port ${p}.`);
    for (let i = 0; i < 20 && !(await isPortFree(p)); i++) await new Promise(r => setTimeout(r, 250));
    if (await isPortFree(p)) return;
  }
  const pid = portOwner(p);
  const owner = pid ? processList().find(x => x.pid === pid) : null;
  const what = owner ? `process ${pid}: ${owner.command.replace(/\s+/g, ' ').slice(0, 120)}` : pid ? `process ${pid}` : 'another program';
  console.error(`Port ${p} is in use by ${what}`);
  console.error(owner && isVenuExpo(owner.command)
    ? 'That is a VenU dev server started outside these scripts. npm run stop ends it.'
    : 'Close that program, or pick another port: -- --port <number>.');
  process.exit(1);
}

/** PID listening on a TCP port, or null. */
function portOwner(p) {
  try {
    if (process.platform === 'win32') {
      const line = execFileSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8' })
        .split('\n').find(l => /LISTENING/.test(l) && new RegExp(`:${p}\\s`).test(l.trim().split(/\s+/)[1] + ' '));
      return line ? Number(line.trim().split(/\s+/).pop()) : null;
    }
    return Number(execFileSync('lsof', ['-nP', `-iTCP:${p}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' }).split('\n')[0]) || null;
  } catch {
    return null;
  }
}

/** An `expo start` running from this folder (by these scripts or by hand). */
function isVenuExpo(command) {
  const cmd = command.replace(/\\/g, '/').toLowerCase();
  return cmd.includes(ROOT.replace(/\\/g, '/').toLowerCase() + '/') && /expo\/bin\/cli|@expo\/cli/.test(cmd);
}

/** [{ pid, command }] for every process, with the full command line. */
function processList() {
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('powershell.exe', ['-NoProfile', '-Command',
        'Get-CimInstance Win32_Process | Where-Object { $_.CommandLine } | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress'],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      return [].concat(JSON.parse(out || '[]')).map(p => ({ pid: p.ProcessId, command: p.CommandLine }));
    }
    return execFileSync('ps', ['-Aww', '-o', 'pid=,args='], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      .split('\n').map(l => /^\s*(\d+)\s+(.*)$/.exec(l)).filter(Boolean).map(m => ({ pid: Number(m[1]), command: m[2] }));
  } catch {
    return [];
  }
}

/** Servers started by this script that are still alive (drops records of ones that aren't). */
function runningServers(list = processList()) {
  if (!existsSync(RUN_DIR)) return [];
  const alive = new Map(list.map(p => [p.pid, p.command]));
  const out = [];
  for (const name of readdirSync(RUN_DIR)) {
    const file = join(RUN_DIR, name);
    let rec = null;
    try { rec = JSON.parse(readFileSync(file, 'utf8')); } catch {}
    // Check the command too, in case the PID was reused by an unrelated program.
    if (rec && rec.pid !== process.pid && /dev\.mjs/.test(alive.get(rec.pid) ?? '')) out.push(rec);
    else if (rec?.pid !== process.pid) rmSync(file, { force: true });
  }
  return out;
}

function killTree(pid) {
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    else {
      try { execFileSync('pkill', ['-TERM', '-P', String(pid)], { stdio: 'ignore' }); } catch {}
      process.kill(pid, 'SIGTERM');
    }
    return true;
  } catch {
    return false;
  }
}

/** Ends servers started by this script, plus any `expo start` running from this folder. */
function stopAll() {
  const stopped = [];
  for (const s of runningServers()) if (killTree(s.pid)) stopped.push(`${s.mode} (port ${s.port})`);
  // Expo started by hand (npx expo start), or left behind by a closed terminal.
  for (const p of processList()) {
    if (p.pid !== process.pid && isVenuExpo(p.command) && killTree(p.pid)) stopped.push(`expo (pid ${p.pid})`);
  }
  rmSync(RUN_DIR, { recursive: true, force: true });
  return stopped;
}
