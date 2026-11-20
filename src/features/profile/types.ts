// Profile shapes shared by onboarding, the Profile tab and (later) matching.
// Codes are stable strings stored in the DB; labels live in options.ts.

import type { NotificationPrefs } from '@/features/settings/notification-prefs';
import type { Availability } from '@/features/volunteer/availability';

import { PRIVACY_VERSION } from './privacy';

export type Role = 'visitor' | 'volunteer';

export type AccessNeed = 'wheelchair' | 'hard_of_hearing' | 'low_vision' | 'walking_aid' | 'other';
export type CommunicationMethod = 'speaking' | 'text' | 'sign_language';
export type HelperGenderPref = 'none' | 'woman' | 'man';
export type HelperAgePref = 'any' | 'under_40' | '40_plus';
export type Training = 'wheelchair' | 'asl' | 'first_aid' | 'sighted_guide' | 'mental_health';
export type Gender = 'woman' | 'man' | 'nonbinary' | 'prefer_not';
export type AgeBand = 'under_40' | '40_plus' | 'prefer_not';

export interface Profile {
  id: string;
  role: Role;
  firstName: string;
  /** Storage path (`<uid>/avatar-<ms>`) on Supabase, or a data/file URI on the device store. */
  avatarPath: string | null;
  /** Language codes, main language included. For volunteers: fluent languages only. */
  languages: string[];
  mainLanguage: string;
  /** Language the app UI should use (read by the translation feature). */
  appLanguage: string;

  // Visitor
  accessNeeds: AccessNeed[];
  accessNeedsNote: string;
  communication: CommunicationMethod[];
  helperGenderPref: HelperGenderPref;
  helperAgePref: HelperAgePref;

  // Volunteer
  trainings: Training[];
  gender: Gender | null;
  ageBand: AgeBand | null;
  /** Set by LA28 staff only; users can't write it. Unverified volunteers can't accept requests yet. */
  verified: boolean;
  /** Free / Busy / Off on the Volunteer tab (visitors keep the default, Free). Saved with saveSettings. */
  availability: Availability;

  /** Which alerts they want (Profile → Notifications). Saved with saveSettings. */
  notificationPrefs: NotificationPrefs;

  privacyVersion: string;
  privacyAcceptedAt: string;
}

/** Settings saved on their own, straight from the screen that shows them (not through the profile form). */
export type ProfileSettings = Pick<Profile, 'availability' | 'notificationPrefs'>;

/** What the onboarding / edit form holds before it's saved. */
export type ProfileDraft = Omit<Profile, 'id' | 'verified' | 'privacyVersion' | 'privacyAcceptedAt' | keyof ProfileSettings> & {
  privacyAccepted: boolean;
};

export function emptyDraft(role: Role, mainLanguage = 'en'): ProfileDraft {
  return {
    role,
    firstName: '',
    avatarPath: null,
    languages: [mainLanguage],
    mainLanguage,
    appLanguage: mainLanguage,
    accessNeeds: [],
    accessNeedsNote: '',
    communication: [],
    helperGenderPref: 'none',
    helperAgePref: 'any',
    trainings: [],
    gender: null,
    ageBand: null,
    privacyAccepted: false,
  };
}

/** Consent carries over only if the policy hasn't changed since they agreed. */
export function draftFromProfile(p: Profile): ProfileDraft {
  const { id: _id, verified: _v, privacyVersion, privacyAcceptedAt: _pa, availability: _a, notificationPrefs: _n, ...rest } = p;
  return { ...rest, privacyAccepted: privacyVersion === PRIVACY_VERSION };
}

/**
 * Whether two drafts say the same thing. Lists (chips, languages) compare as sets: ticking a chip
 * off and on again moves it to the end but changes nothing.
 * e.g. accessNeeds ['wheelchair', 'low_vision'] vs ['low_vision', 'wheelchair'] → true
 */
export function sameDraft(a: ProfileDraft, b: ProfileDraft): boolean {
  const keys = Object.keys({ ...a, ...b }) as (keyof ProfileDraft)[];
  return keys.every(k => {
    const x = a[k];
    const y = b[k];
    if (Array.isArray(x) && Array.isArray(y)) return x.length === y.length && x.every(v => (y as unknown[]).includes(v));
    return x === y;
  });
}

/** Where each role lands after sign-in or setup. */
export function homeFor(p: Pick<Profile, 'role'>): '/venue' | '/volunteer' {
  return p.role === 'volunteer' ? '/volunteer' : '/venue';
}
