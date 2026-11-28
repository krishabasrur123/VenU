// What the username-sign-in, password-reset and delete-account functions share: CORS headers, JSON
// replies, the caller's IP, and the server key. Plain TypeScript (no Deno globals), so the mock
// (scripts/mock-supabase.mjs, Node) and the jest tests load it as well.
// The Supabase CLI bundles it with each function. The dashboard editor takes flat files only: deploy
// it next to the function's index.ts and handler.ts as edge.ts, with `../_shared/edge.ts` → `./edge.ts`.

/** Browsers call these functions from the web app on another origin. */
export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** A JSON reply with the CORS headers, e.g. json(400, { code: 'bad_request' }). */
export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

export type ClientIpSource = 'cf-connecting-ip' | 'none';

/**
 * The caller's IP for Auth's per-IP rate limit, and where it came from. Only Cf-Connecting-Ip:
 * Cloudflare, in front of Supabase's functions, overwrites whatever a caller sends there. Never
 * X-Forwarded-For, whose leftmost entry is the caller's own say-so (a brute-forcer would rotate it
 * and never be limited). Without the header nothing is forwarded, and Auth counts the function's
 * own IP: stricter, never looser.
 *   Cf-Connecting-Ip: 203.0.113.7               → { ip: '203.0.113.7', source: 'cf-connecting-ip' }
 *   X-Forwarded-For: 198.51.100.1, 203.0.113.7  → { ip: null, source: 'none' }
 */
export function clientIpOf(req: Request): { ip: string | null; source: ClientIpSource } {
  const cf = req.headers.get('cf-connecting-ip')?.trim();
  return cf ? { ip: cf, source: 'cf-connecting-ip' } : { ip: null, source: 'none' };
}

/**
 * The project's default secret key (sb_secret_…), else the legacy service_role key, from the
 * function's environment (index.ts passes Deno.env.get).
 */
export function serverKey(env: (name: string) => string | undefined): string {
  try {
    const secret = (JSON.parse(env('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>).default;
    if (secret) return secret;
  } catch {
    // Not set or not JSON: use the legacy key.
  }
  return env('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}
