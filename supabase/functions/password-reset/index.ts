// Supabase Edge Function "password-reset": Forgot Password by username, without showing anyone the
// email or whether the username exists.
// Deploy: supabase functions deploy password-reset --no-verify-jwt
// --no-verify-jwt: callers are signed out by definition, and a publishable key is not a JWT.
// Secrets: none to set. Supabase gives every function SUPABASE_URL and its keys.
// Auth must allow the link's target: Authentication > URL Configuration > Redirect URLs gets
// <site>/reset-password (and venu://reset-password for the phone app).
// Until it's deployed, the app asks for the email instead of a username.
// Contract: handler.ts. Files: index.ts, handler.ts, deno.json and ../_shared/edge.ts (see there for the dashboard).
import { createClient } from '@supabase/supabase-js';

import { serverKey } from '../_shared/edge.ts';
import { createHandler, httpRecover } from './handler.ts';

// The Deno globals this file uses, so the app's `tsc` can check it too (no Deno types in the repo).
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): unknown;
};

const env = (name: string) => Deno.env.get(name);

const url = env('SUPABASE_URL') ?? '';
const key = serverKey(env);
if (!url || !key) console.error('password-reset: SUPABASE_URL or a server key is missing; reset links will fail');

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

async function emailForUsername(username: string): Promise<string | null> {
  const { data, error } = await admin.rpc('email_for_username', { p_username: username });
  if (error) throw new Error(error.message);
  return typeof data === 'string' && data ? data : null;
}

Deno.serve(createHandler({ emailForUsername, sendRecovery: httpRecover(url, key) }));
