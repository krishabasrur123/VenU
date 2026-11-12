// A small stand-in for Supabase (auth, the `profiles` table, the `avatars` bucket) for testing on
// your own machine without a real project. It mirrors the rules in supabase/migrations: users see
// and change only their own row, can't change role or verified, and keep photos in their own folder.
// Started by `npm run dev:mock`; see scripts/dev.mjs.
//
// Test hooks: GET /__state (everything stored), POST /__control { dropNextProfileWrite: n }
// (drop the next n profile-save responses, to test lost connections), GET /__confirm?email=...
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

// Below 49152 on purpose: Windows (Hyper-V, WSL, Docker) reserves blocks of 49152-65535 that move
// between reboots, and a reserved port fails with EACCES. 54330 was inside one of those blocks.
export const MOCK_SUPABASE_PORT = 47330;

/**
 * @param {{ port: number, confirmEmail?: boolean, stateFile?: string, log?: (line: string) => void }} options
 *   confirmEmail: sign-up sends a (printed) confirmation link instead of signing straight in.
 *   stateFile: keep accounts, profiles and photos here between runs.
 */
export function startMockSupabase({ port, confirmEmail = false, stateFile, log = console.log }) {
  const users = new Map(); // email -> { id, email, password, confirmed }
  const profiles = new Map(); // user id -> row
  const files = new Map(); // path -> { bytes: Buffer, type }
  const refreshTokens = new Map(); // token -> user id
  const requests = [];
  const control = { dropNextProfileWrite: 0 };

  if (stateFile && existsSync(stateFile)) {
    try {
      const saved = JSON.parse(readFileSync(stateFile, 'utf8'));
      for (const u of saved.users ?? []) users.set(u.email, u);
      for (const p of saved.profiles ?? []) profiles.set(p.id, p);
      for (const [path, f] of Object.entries(saved.files ?? {})) files.set(path, { bytes: Buffer.from(f.bytes, 'base64'), type: f.type });
      for (const [token, id] of Object.entries(saved.refreshTokens ?? {})) refreshTokens.set(token, id);
    } catch {
      log(`mock supabase: couldn't read ${stateFile}, starting empty`);
    }
  }
  function persist() {
    if (!stateFile) return;
    mkdirSync(dirname(stateFile), { recursive: true });
    writeFileSync(stateFile, JSON.stringify({
      users: [...users.values()],
      profiles: [...profiles.values()],
      files: Object.fromEntries([...files].map(([path, f]) => [path, { bytes: f.bytes.toString('base64'), type: f.type }])),
      refreshTokens: Object.fromEntries(refreshTokens),
    }));
  }

  const b64url = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const publicUser = u => ({
    id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email,
    email_confirmed_at: u.confirmed ? '2026-11-09T00:00:00Z' : null,
    app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-11-09T00:00:00Z',
  });
  function session(user) {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const refresh_token = randomUUID();
    refreshTokens.set(refresh_token, user.id);
    persist();
    return {
      access_token: `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', exp })}.mock`,
      token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token, user: publicUser(user),
    };
  }
  /** The signed-in user's id, or null. Tokens for users that no longer exist don't count. */
  function userIdOf(req) {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
    if (!m) return null;
    try {
      const claims = JSON.parse(Buffer.from(m[1].split('.')[1], 'base64url').toString());
      if (claims.exp * 1000 < Date.now()) return null;
      return [...users.values()].some(u => u.id === claims.sub) ? claims.sub : null;
    } catch {
      return null;
    }
  }
  function send(res, status, body, headers = {}) {
    res.writeHead(status, { 'content-type': 'application/json', ...headers });
    res.end(body === undefined ? '' : JSON.stringify(body));
  }
  const authErr = (res, status, code, message) => send(res, status, { code, error_code: code, msg: message, message });
  const pgErr = (res, status, code, message) => send(res, status, { code, message, details: null, hint: null });

  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] ?? '*');
    res.setHeader('Access-Control-Expose-Headers', '*');
    if (req.method === 'OPTIONS') return send(res, 204);

    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks);
    const url = new URL(req.url, 'http://mock');
    const p = url.pathname;
    const json = () => { try { return JSON.parse(raw.toString() || 'null'); } catch { return null; } };
    requests.push(`${req.method} ${p}${url.search}`);
    const uid = userIdOf(req);

    // ---- test hooks
    if (p === '/__state') {
      return send(res, 200, { users: [...users.values()].map(u => ({ id: u.id, email: u.email, confirmed: u.confirmed })), profiles: [...profiles.values()], files: [...files.keys()], log: requests });
    }
    if (p === '/__control') { Object.assign(control, json()); return send(res, 200, control); }
    if (p === '/__confirm') {
      const user = users.get(url.searchParams.get('email') ?? '');
      if (user) { user.confirmed = true; persist(); }
      res.writeHead(user ? 200 : 404, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(user ? `<p style="font:16px system-ui">Email confirmed for ${user.email}. Go back to VenU and sign in.</p>` : 'No account with that email.');
    }

    // ---- auth
    if (p === '/auth/v1/signup' && req.method === 'POST') {
      const { email, password } = json() ?? {};
      if (users.has(email)) return authErr(res, 422, 'user_already_exists', 'User already registered');
      const user = { id: randomUUID(), email, password, confirmed: !confirmEmail };
      users.set(email, user);
      persist();
      if (!confirmEmail) return send(res, 200, session(user));
      log(`\n  Confirmation "email" for ${email}: http://localhost:${port}/__confirm?email=${encodeURIComponent(email)}\n`);
      return send(res, 200, publicUser(user)); // a user but no session: the app shows "Check your email"
    }
    if (p === '/auth/v1/token' && req.method === 'POST') {
      const body = json() ?? {};
      const grant = url.searchParams.get('grant_type');
      if (grant === 'password') {
        const user = users.get(body.email);
        if (!user || user.password !== body.password) return authErr(res, 400, 'invalid_credentials', 'Invalid login credentials');
        if (!user.confirmed) return authErr(res, 400, 'email_not_confirmed', 'Email not confirmed');
        return send(res, 200, session(user));
      }
      if (grant === 'refresh_token') {
        const id = refreshTokens.get(body.refresh_token);
        const user = [...users.values()].find(u => u.id === id);
        if (!user) return authErr(res, 400, 'refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found');
        refreshTokens.delete(body.refresh_token);
        return send(res, 200, session(user));
      }
    }
    if (p === '/auth/v1/logout' && req.method === 'POST') {
      // Default scope is global: every session of this user ends.
      for (const [token, id] of refreshTokens) if (id === uid) refreshTokens.delete(token);
      persist();
      return send(res, 204);
    }
    if (p === '/auth/v1/user' && req.method === 'GET') {
      const user = [...users.values()].find(u => u.id === uid);
      return user ? send(res, 200, publicUser(user)) : authErr(res, 401, 'bad_jwt', 'invalid JWT');
    }

    // ---- the profiles table
    if (p === '/rest/v1/profiles') {
      if (!uid) return pgErr(res, 401, 'PGRST301', 'JWT expired');
      const wantsObject = (req.headers.accept ?? '').includes('vnd.pgrst.object');
      const idEq = url.searchParams.get('id')?.replace(/^eq\./, '');
      const reply = (rows, status = 200) => {
        if (!wantsObject) return send(res, status, rows);
        if (rows.length !== 1) return pgErr(res, 406, 'PGRST116', 'JSON object requested, multiple (or no) rows returned');
        return send(res, status, rows[0]);
      };
      const checkRow = r => {
        if (r.avatar_path != null && !new RegExp(`^${r.id}/[A-Za-z0-9._-]+$`).test(r.avatar_path)) return 'new row for relation "profiles" violates check constraint "avatar_path_own_folder"';
        if (!Array.isArray(r.languages) || !r.languages.includes(r.main_language)) return 'new row for relation "profiles" violates check constraint "main_language_listed"';
        return null;
      };
      // Simulates a lost connection: the write is saved but the app never hears back.
      const dropResponse = () => {
        if (control.dropNextProfileWrite <= 0) return false;
        control.dropNextProfileWrite -= 1;
        requests.push('  (response dropped)');
        req.socket.destroy();
        return true;
      };
      if (req.method === 'GET') {
        const own = [...profiles.values()].filter(r => r.id === uid && (!idEq || r.id === idEq));
        const cols = url.searchParams.get('select');
        return reply(cols && cols !== '*' ? own.map(r => Object.fromEntries(cols.split(',').map(c => [c, r[c]]))) : own);
      }
      if (req.method === 'POST') {
        const body = json();
        const row = Array.isArray(body) ? body[0] : body;
        if (row?.id !== uid || row.verified) return pgErr(res, 403, '42501', 'new row violates row-level security policy for table "profiles"');
        if (profiles.has(row.id)) return pgErr(res, 409, '23505', 'duplicate key value violates unique constraint "profiles_pkey"');
        const now = new Date().toISOString();
        const full = { ...row, verified: false, created_at: now, updated_at: now };
        const bad = checkRow(full);
        if (bad) return pgErr(res, 400, '23514', bad);
        profiles.set(row.id, full);
        persist();
        if (dropResponse()) return;
        return reply([full], 201);
      }
      if (req.method === 'PATCH') {
        const body = json() ?? {};
        if ('role' in body || 'verified' in body || 'id' in body) return pgErr(res, 403, '42501', 'permission denied for table profiles');
        const existing = idEq === uid ? profiles.get(uid) : undefined;
        if (!existing) return reply([]);
        const next = { ...existing, ...body, updated_at: new Date().toISOString() };
        const bad = checkRow(next);
        if (bad) return pgErr(res, 400, '23514', bad);
        profiles.set(uid, next);
        persist();
        if (dropResponse()) return;
        return reply([next]);
      }
      if (req.method === 'DELETE') {
        if (idEq === uid) { profiles.delete(uid); persist(); }
        return send(res, 204);
      }
    }

    // ---- the avatars bucket (private: owners only)
    const ownPath = path => path.split('/')[0] === uid;
    let m;
    if ((m = /^\/storage\/v1\/object\/avatars\/(.+)$/.exec(p)) && (req.method === 'POST' || req.method === 'PUT')) {
      const path = decodeURIComponent(m[1]);
      if (!uid || !ownPath(path)) return send(res, 403, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' });
      if (files.has(path) && req.headers['x-upsert'] !== 'true') return send(res, 409, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' });
      if (raw.length > MAX_PHOTO_BYTES) return send(res, 413, { statusCode: '413', error: 'Payload too large', message: 'The object exceeded the maximum allowed size' });
      files.set(path, { bytes: raw, type: req.headers['content-type'] ?? 'application/octet-stream' });
      persist();
      return send(res, 200, { Key: `avatars/${path}`, Id: randomUUID() });
    }
    if ((m = /^\/storage\/v1\/object\/sign\/avatars\/(.+)$/.exec(p)) && req.method === 'POST') {
      const path = decodeURIComponent(m[1]);
      if (!uid || !ownPath(path) || !files.has(path)) return send(res, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
      return send(res, 200, { signedURL: `/object/sign/avatars/${path}?token=${randomUUID()}` });
    }
    if ((m = /^\/storage\/v1\/object\/sign\/avatars\/(.+)$/.exec(p)) && req.method === 'GET') {
      const f = files.get(decodeURIComponent(m[1]));
      if (!f) return send(res, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
      res.writeHead(200, { 'content-type': f.type });
      return res.end(f.bytes);
    }
    if (p === '/storage/v1/object/list/avatars' && req.method === 'POST') {
      const { prefix = '', limit = 100, offset = 0 } = json() ?? {};
      if (!uid || prefix.replace(/\/$/, '') !== uid) return send(res, 200, []);
      const names = [...files.keys()].filter(k => k.startsWith(`${uid}/`)).map(k => k.slice(uid.length + 1)).sort();
      return send(res, 200, names.slice(offset, offset + limit).map(name => ({ name, id: randomUUID(), metadata: {} })));
    }
    if (p === '/storage/v1/object/avatars' && req.method === 'DELETE') {
      const { prefixes = [] } = json() ?? {};
      const gone = prefixes.filter(k => ownPath(k) && files.delete(k)).map(name => ({ name }));
      persist();
      return send(res, 200, gone);
    }

    requests.push('  (no route)');
    send(res, 404, { message: `mock supabase: no route for ${req.method} ${p}` });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => resolve(server));
  });
}

// Run on its own: node scripts/mock-supabase.mjs [port] [--confirm-email]
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.argv.find(a => /^\d+$/.test(a)) ?? MOCK_SUPABASE_PORT);
  await startMockSupabase({ port, confirmEmail: process.argv.includes('--confirm-email') });
  console.log(`mock supabase on http://localhost:${port}`);
}
