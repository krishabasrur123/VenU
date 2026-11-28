// Reads what Supabase Auth puts on the URL it sends someone back to: a password-reset link
// (/reset-password) or a social sign-in (/auth-callback). The client uses the implicit flow
// (supabase-js's default; src/lib/supabase.ts), so a success carries the session in the fragment
// and a failure carries error fields in the fragment or the query. Pure, so jest runs it directly.
//   …/reset-password#access_token=at&refresh_token=rt&expires_in=3600&type=recovery
//     → { kind: 'session', accessToken: 'at', refreshToken: 'rt', type: 'recovery' }
//   …/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid
//     → { kind: 'error', code: 'otp_expired', description: 'Email link is invalid' }
//   …/auth-callback?error=invalid_request&error_description=Unsupported+provider
//     → { kind: 'error', code: 'invalid_request', description: 'Unsupported provider' }
//   …/reset-password → { kind: 'none' }

import { FIRST_NAME_MAX, firstNameFrom } from '@/features/profile/validate';

export type AuthRedirect =
  | { kind: 'session'; accessToken: string; refreshToken: string; type: string | null }
  | { kind: 'error'; code: string; description: string }
  | { kind: 'none' };

/** Supabase's three social providers on the Figma landing page (482:31962), in its order. */
export const OAUTH_PROVIDERS = ['facebook', 'google', 'apple'] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

/** The provider's own name, the same in every language: 'google' → 'Google'. */
export function providerName(provider: OAuthProvider): string {
  return { facebook: 'Facebook', google: 'Google', apple: 'Apple' }[provider];
}

function paramsOf(part: string): URLSearchParams {
  return new URLSearchParams(part.replace(/^[#?]/, ''));
}

export function parseAuthRedirect(url: string | null | undefined): AuthRedirect {
  if (!url) return { kind: 'none' };
  const hashAt = url.indexOf('#');
  const queryAt = url.indexOf('?');
  const hash = paramsOf(hashAt >= 0 ? url.slice(hashAt) : '');
  const query = paramsOf(queryAt >= 0 ? url.slice(queryAt, hashAt >= 0 && hashAt > queryAt ? hashAt : undefined) : '');
  for (const p of [hash, query]) {
    const error = p.get('error_code') || p.get('error');
    if (error) return { kind: 'error', code: error, description: p.get('error_description') ?? '' };
  }
  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  if (accessToken && refreshToken) return { kind: 'session', accessToken, refreshToken, type: hash.get('type') };
  return { kind: 'none' };
}

/**
 * The first name to start setup with, from what a social provider shares: Google and Facebook send
 * `full_name` / `name`, Apple sends a name only the first time (often not at all).
 *   { full_name: 'Rosa María López' } → 'Rosa'   ·   {} → undefined
 */
export function firstNameFromMetadata(meta: Record<string, unknown> | null | undefined): string | undefined {
  const given = meta?.given_name ?? meta?.first_name;
  if (typeof given === 'string' && given.trim()) return given.trim().slice(0, FIRST_NAME_MAX);
  const full = meta?.full_name ?? meta?.name;
  if (typeof full !== 'string') return undefined;
  return firstNameFrom(full) || undefined;
}
