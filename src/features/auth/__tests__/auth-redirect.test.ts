import { describe, expect, it } from '@jest/globals';

import { firstNameFromMetadata, parseAuthRedirect } from '../auth-redirect';
import { newPasswordError, resetIdentifierError } from '../validate';

describe('parseAuthRedirect', () => {
  it('reads a reset link’s session from the fragment', () => {
    expect(parseAuthRedirect('https://venu.example/reset-password#access_token=at&expires_in=3600&refresh_token=rt&token_type=bearer&type=recovery'))
      .toEqual({ kind: 'session', accessToken: 'at', refreshToken: 'rt', type: 'recovery' });
  });

  it('reads a social sign-in’s session (no type) and a phone deep link', () => {
    expect(parseAuthRedirect('venu://auth-callback#access_token=a&refresh_token=r&provider_token=p'))
      .toEqual({ kind: 'session', accessToken: 'a', refreshToken: 'r', type: null });
  });

  it('prefers error_code to error, in the fragment or the query', () => {
    expect(parseAuthRedirect('https://x/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'))
      .toEqual({ kind: 'error', code: 'otp_expired', description: 'Email link is invalid or has expired' });
    expect(parseAuthRedirect('https://x/auth-callback?error=invalid_request&error_description=Unsupported+provider'))
      .toEqual({ kind: 'error', code: 'invalid_request', description: 'Unsupported provider' });
  });

  it('keeps the query and fragment apart', () => {
    expect(parseAuthRedirect('https://x/auth-callback?next=1#access_token=a&refresh_token=r'))
      .toEqual({ kind: 'session', accessToken: 'a', refreshToken: 'r', type: null });
  });

  it.each([[null], [''], ['https://x/reset-password'], ['https://x/reset-password#access_token=only']])('finds nothing in %p', url => {
    expect(parseAuthRedirect(url)).toEqual({ kind: 'none' });
  });
});

describe('firstNameFromMetadata', () => {
  it.each([
    [{ full_name: 'Rosa María López' }, 'Rosa'],
    [{ name: '  Sam ' }, 'Sam'],
    [{ given_name: 'Ana', full_name: 'Ana Lima' }, 'Ana'],
    [{}, undefined],
    [null, undefined],
    [{ full_name: 42 }, undefined],
  ])('%p → %p', (meta, want) => {
    expect(firstNameFromMetadata(meta as Record<string, unknown> | null)).toBe(want);
  });
});

describe('Forgot / New Password checks', () => {
  it('takes a username or an email that could exist', () => {
    expect(resetIdentifierError('rosa_m')).toBeNull();
    expect(resetIdentifierError(' rosa@example.com ')).toBeNull();
    expect(resetIdentifierError('  ')).toBe('Enter your username or email.');
    expect(resetIdentifierError('rosa@')).toBe('Enter a valid email.');
    expect(resetIdentifierError('ro')).toBe('Use 3–20 characters for your username.');
  });

  it('wants the Create Account length, typed the same twice', () => {
    expect(newPasswordError('short', 'short')).toEqual({ field: 'password', message: 'Use at least 8 characters for your password.' });
    expect(newPasswordError('long-enough', 'long-enougH')).toEqual({ field: 'confirm', message: 'The passwords don’t match.' });
    expect(newPasswordError('long-enough', 'long-enough')).toBeNull();
  });
});
