// Which app languages have translated screen text, and how to pick one from a stored code.
// e.g. resolveUiLanguage('es') → 'es'; resolveUiLanguage('de') → 'en' (German isn't translated yet);
// resolveUiLanguage('pt-BR') → 'pt'.

import { LANGUAGES, type Language } from '@/features/profile/options';

export const DEFAULT_LANGUAGE = 'en';

/** Codes with string tables under locales/. Keep in sync with locales/index.ts (a test checks). */
export const TRANSLATED = ['en', 'es', 'zh', 'ko', 'tl', 'vi', 'hy', 'fa', 'ja', 'ru', 'ar', 'fr', 'pt'] as const;
export type UiLanguage = (typeof TRANSLATED)[number];

/** The LANGUAGES entries the UI is translated into, in LANGUAGES order. */
export const UI_LANGUAGES: Language[] = LANGUAGES.filter(l => (TRANSLATED as readonly string[]).includes(l.code));

const RTL = new Set(['ar', 'fa', 'he', 'ur', 'ps', 'yi']);

export function isRtl(code: string): boolean {
  return RTL.has(code.split('-')[0].toLowerCase());
}

export function isUiLanguage(code: string | null | undefined): code is UiLanguage {
  return !!code && (TRANSLATED as readonly string[]).includes(code);
}

/** Maps any stored or device code to a translated one; anything untranslated gets English. */
export function resolveUiLanguage(code: string | null | undefined): UiLanguage {
  if (!code) return DEFAULT_LANGUAGE;
  const base = code.split(/[-_]/)[0].toLowerCase();
  if (isUiLanguage(base)) return base;
  if (base === 'fil') return 'tl'; // devices report Filipino as fil
  return DEFAULT_LANGUAGE;
}

/**
 * Which language the app should show, by priority: the signed-in profile's app language, else the
 * language picked on the welcome screen, else the device language, else English.
 * e.g. pickUiLanguage({ profile: null, pending: 'ko', device: 'es-MX' }) → 'ko'
 */
export function pickUiLanguage(sources: { profile?: string | null; pending?: string | null; device?: string | null }): UiLanguage {
  return resolveUiLanguage(sources.profile || sources.pending || sources.device);
}
