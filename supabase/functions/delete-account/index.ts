// Supabase Edge Function "delete-account": Profile → Delete my data removes the sign-in too.
// Deploy (after applying supabase/migrations/20261118030000_account_deletion.sql, without which
// deleting a volunteer with a finished request fails):
//   supabase functions deploy delete-account
// If calls fail at the gateway with the new signing keys, redeploy with --no-verify-jwt: the
// function verifies the token itself.
// Secrets: none to set. Supabase gives every function SUPABASE_URL and its keys.
// Until it's deployed the app deletes the profile and photo only and says the sign-in remains.
// Contract: handler.ts. Files: index.ts, handler.ts, deno.json and ../_shared/edge.ts (see there for the dashboard).
import { createClient } from '@supabase/supabase-js';

import { serverKey } from '../_shared/edge.ts';
import { createHandler } from './handler.ts';

// The Deno globals this file uses, so the app's `tsc` can check it too (no Deno types in the repo).
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): unknown;
};

const env = (name: string) => Deno.env.get(name);

const url = env('SUPABASE_URL') ?? '';
const key = serverKey(env);
if (!url || !key) console.error('delete-account: SUPABASE_URL or a server key is missing; deletes will fail');

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(url, key, options);
// SUPABASE_ANON_KEY is set for every Edge Function by Supabase.
const anon = createClient(url, env('SUPABASE_ANON_KEY') ?? '', options);

const BUCKET = 'avatars';
const PAGE = 100;

/** Checks the access token's signature and expiry; only real signed-in users pass (not the anon key, not anonymous sign-ins). */
async function verifyUser(token: string): Promise<string | null> {
  const { data, error } = await anon.auth.getClaims(token);
  const claims = data?.claims;
  if (error || !claims || claims.role !== 'authenticated' || claims.is_anonymous) return null;
  return typeof claims.sub === 'string' ? claims.sub : null;
}

async function listAvatars(userId: string): Promise<string[]> {
  const paths: string[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await admin.storage.from(BUCKET).list(userId, { limit: PAGE, offset });
    if (error) throw new Error(error.message);
    paths.push(...data.map(f => `${userId}/${f.name}`));
    if (data.length < PAGE) return paths;
  }
}

async function removeAvatars(paths: string[]): Promise<void> {
  for (let i = 0; i < paths.length; i += PAGE) {
    const { error } = await admin.storage.from(BUCKET).remove(paths.slice(i, i + PAGE));
    if (error) throw new Error(error.message);
  }
}

async function deleteUser(userId: string): Promise<'deleted' | 'gone'> {
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (!error) return 'deleted';
  // A retry after a lost response: the user is already gone, which is what was asked.
  if (error.status === 404 || (error as { code?: string }).code === 'user_not_found') return 'gone';
  throw new Error(`${error.status ?? ''} ${(error as { code?: string }).code ?? ''} ${error.message}`.trim());
}

Deno.serve(createHandler({ verifyUser, listAvatars, removeAvatars, deleteUser }));
