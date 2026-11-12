// Every string table, bundled into the app (no network loading). Metro needs literal require paths,
// so a new language or namespace is added here by hand; the parity test fails if one is missed.

import common from './en/common.json';
import onboarding from './en/onboarding.json';
import profile from './en/profile.json';
import venue from './en/venue.json';
import volunteer from './en/volunteer.json';

import type { UiLanguage } from '../languages';

export const NAMESPACES = ['common', 'onboarding', 'profile', 'venue', 'volunteer'] as const;
export type Namespace = (typeof NAMESPACES)[number];

/** English is the source of truth: its keys type `t()` and every other language must match it. */
export const en = { common, onboarding, profile, venue, volunteer };
export type Resources = typeof en;

export const resources: Record<UiLanguage, Resources> = {
  en,
  es: { common: require('./es/common.json'), onboarding: require('./es/onboarding.json'), profile: require('./es/profile.json'), venue: require('./es/venue.json'), volunteer: require('./es/volunteer.json') },
  zh: { common: require('./zh/common.json'), onboarding: require('./zh/onboarding.json'), profile: require('./zh/profile.json'), venue: require('./zh/venue.json'), volunteer: require('./zh/volunteer.json') },
  ko: { common: require('./ko/common.json'), onboarding: require('./ko/onboarding.json'), profile: require('./ko/profile.json'), venue: require('./ko/venue.json'), volunteer: require('./ko/volunteer.json') },
  tl: { common: require('./tl/common.json'), onboarding: require('./tl/onboarding.json'), profile: require('./tl/profile.json'), venue: require('./tl/venue.json'), volunteer: require('./tl/volunteer.json') },
  vi: { common: require('./vi/common.json'), onboarding: require('./vi/onboarding.json'), profile: require('./vi/profile.json'), venue: require('./vi/venue.json'), volunteer: require('./vi/volunteer.json') },
  hy: { common: require('./hy/common.json'), onboarding: require('./hy/onboarding.json'), profile: require('./hy/profile.json'), venue: require('./hy/venue.json'), volunteer: require('./hy/volunteer.json') },
  fa: { common: require('./fa/common.json'), onboarding: require('./fa/onboarding.json'), profile: require('./fa/profile.json'), venue: require('./fa/venue.json'), volunteer: require('./fa/volunteer.json') },
  ja: { common: require('./ja/common.json'), onboarding: require('./ja/onboarding.json'), profile: require('./ja/profile.json'), venue: require('./ja/venue.json'), volunteer: require('./ja/volunteer.json') },
  ru: { common: require('./ru/common.json'), onboarding: require('./ru/onboarding.json'), profile: require('./ru/profile.json'), venue: require('./ru/venue.json'), volunteer: require('./ru/volunteer.json') },
  ar: { common: require('./ar/common.json'), onboarding: require('./ar/onboarding.json'), profile: require('./ar/profile.json'), venue: require('./ar/venue.json'), volunteer: require('./ar/volunteer.json') },
  fr: { common: require('./fr/common.json'), onboarding: require('./fr/onboarding.json'), profile: require('./fr/profile.json'), venue: require('./fr/venue.json'), volunteer: require('./fr/volunteer.json') },
  pt: { common: require('./pt/common.json'), onboarding: require('./pt/onboarding.json'), profile: require('./pt/profile.json'), venue: require('./pt/venue.json'), volunteer: require('./pt/volunteer.json') },
};
