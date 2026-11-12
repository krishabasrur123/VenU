import { describe, expect, it } from '@jest/globals';

import { validateAuth } from '../validate';

const ok = { email: 'rosa@example.com', password: 'longenough', termsAccepted: true };

describe('validateAuth', () => {
  it('accepts a complete sign-up and sign-in', () => {
    expect(validateAuth('signup', ok, false)).toBeNull();
    expect(validateAuth('signin', { email: ok.email, password: 'x' }, false)).toBeNull();
  });

  it('points each problem at its field', () => {
    expect(validateAuth('signin', { ...ok, email: 'rosa' }, false)?.field).toBe('email');
    expect(validateAuth('signin', { ...ok, password: '' }, false)?.field).toBe('password');
    expect(validateAuth('signup', { ...ok, password: 'short' }, false)).toEqual({
      field: 'password',
      message: 'Use at least 8 characters for your password.',
    });
  });

  it('requires the terms box on sign-up only', () => {
    expect(validateAuth('signup', { ...ok, termsAccepted: false }, false)?.field).toBe('terms');
    expect(validateAuth('signin', { ...ok, termsAccepted: false }, false)).toBeNull();
  });

  it('lets any email and password through in local mode, but still asks for the terms', () => {
    expect(validateAuth('signin', { email: '', password: '' }, true)).toBeNull();
    expect(validateAuth('signup', { email: '', password: '', termsAccepted: false }, true)?.field).toBe('terms');
    expect(validateAuth('signup', { email: '', password: '', termsAccepted: true }, true)).toBeNull();
  });
});
