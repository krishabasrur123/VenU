// Checks for the Sign In and Create Account forms (pure, so jest can run them without a backend).
// Messages are in the UI language (onboarding:validate.*).

import i18n from '@/i18n';

import { isEmailLike, normalizeUsername, USERNAME_MAX, USERNAME_MIN, usernameProblem } from './username';

export type AuthMode = 'signin' | 'signup';
/** 'email' is Sign In's "Username" field too, which takes a username or an email. */
export type AuthField = 'email' | 'username' | 'password' | 'terms';

/** `field` puts the message under that input; null shows it above the button (e.g. wrong password). */
export interface AuthError {
  field: AuthField | null;
  message: string;
}

export interface AuthValues {
  /** Create Account: the email. Sign In: a username or an email. */
  email: string;
  password: string;
  /** Create Account only. */
  name?: string;
  username?: string;
  termsAccepted?: boolean;
}

export const MIN_PASSWORD = 8;

/** The message for a username that breaks the rules, or null. */
export function usernameError(raw: string): string | null {
  const problem = usernameProblem(normalizeUsername(raw));
  if (problem === 'length') return i18n.t('onboarding:validate.usernameLength', { min: USERNAME_MIN, max: USERNAME_MAX });
  if (problem === 'chars') return i18n.t('onboarding:validate.usernameChars');
  return null;
}

/**
 * The first problem with the form, or null.
 * `local` (no backend): any email and password continue, but the username has to follow the rules
 * and the terms box still has to be ticked.
 */
export function validateAuth(mode: AuthMode, v: AuthValues, local: boolean): AuthError | null {
  if (!local) {
    if (mode === 'signup' || isEmailLike(v.email)) {
      if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) return { field: 'email', message: i18n.t('onboarding:validate.email') };
    } else if (!v.email.trim()) {
      return { field: 'email', message: i18n.t('onboarding:validate.identifier') };
    } else if (usernameError(v.email)) {
      // A sign-in name that can't exist: say how usernames look rather than "wrong password".
      return { field: 'email', message: usernameError(v.email)! };
    }
  }
  if (mode === 'signup') {
    const bad = usernameError(v.username ?? '');
    if (bad) return { field: 'username', message: bad };
  }
  if (!local) {
    if (mode === 'signup' && v.password.length < MIN_PASSWORD)
      return { field: 'password', message: i18n.t('onboarding:validate.passwordLength', { min: MIN_PASSWORD }) };
    if (!v.password) return { field: 'password', message: i18n.t('onboarding:validate.password') };
  }
  if (mode === 'signup' && !v.termsAccepted)
    return { field: 'terms', message: i18n.t('onboarding:validate.terms') };
  return null;
}

/** Forgot Password: the first problem with the typed username or email, or null. */
export function resetIdentifierError(raw: string): string | null {
  const typed = raw.trim();
  if (!typed) return i18n.t('onboarding:validate.identifier');
  if (isEmailLike(typed)) return /^\S+@\S+\.\S+$/.test(typed) ? null : i18n.t('onboarding:validate.email');
  return usernameError(typed);
}

/** New Password: the Create Account rule (at least MIN_PASSWORD characters), typed the same twice. */
export function newPasswordError(password: string, confirm: string): { field: 'password' | 'confirm'; message: string } | null {
  if (password.length < MIN_PASSWORD) return { field: 'password', message: i18n.t('onboarding:validate.passwordLength', { min: MIN_PASSWORD }) };
  if (confirm !== password) return { field: 'confirm', message: i18n.t('onboarding:validate.passwordMatch') };
  return null;
}
