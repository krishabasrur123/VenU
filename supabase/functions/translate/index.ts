// Supabase Edge Function "translate": translates chat messages for signed-in users.
// Deploy: supabase functions deploy translate --no-verify-jwt
// --no-verify-jwt ("Verify JWT" off in the dashboard): verifyUser below checks the token itself, which
// also works with the new JWT signing keys, where the gateway check can reject valid sessions.
// Secrets: supabase secrets set TRANSLATE_PROVIDER=anthropic ANTHROPIC_API_KEY=...   (or deepl + DEEPL_API_KEY)
// Contract and limits: core.ts. The provider keys stay here; the app never sees them.
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

import { chooseProvider, createHandler } from './handler.ts';

// The Deno globals this file uses, so the app's `tsc` can check it too (no Deno types in the repo).
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): unknown;
};

const env = (name: string) => Deno.env.get(name);

// SUPABASE_URL and SUPABASE_ANON_KEY are set for every Edge Function by Supabase.
const supabase = createClient(env('SUPABASE_URL') ?? '', env('SUPABASE_ANON_KEY') ?? '', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

/** Checks the access token's signature and expiry; only real signed-in users pass (not the anon key, not anonymous sign-ins). */
async function verifyUser(token: string): Promise<string | null> {
  const { data, error } = await supabase.auth.getClaims(token);
  const claims = data?.claims;
  if (error || !claims || claims.role !== 'authenticated' || claims.is_anonymous) return null;
  return typeof claims.sub === 'string' ? claims.sub : null;
}

const choice = chooseProvider(
  { TRANSLATE_PROVIDER: env('TRANSLATE_PROVIDER'), ANTHROPIC_API_KEY: env('ANTHROPIC_API_KEY'), DEEPL_API_KEY: env('DEEPL_API_KEY') },
  apiKey => new Anthropic({ apiKey, timeout: 20_000, maxRetries: 2 }),
);
if (!choice.ok) console.error(`translate: ${choice.reason}; requests will get 503`);

Deno.serve(createHandler({ verifyUser, translator: choice.ok ? choice.translator : null }));
