import i18n from '@/i18n';
import type { Resources } from '@/i18n/locales';

import { ACCESS_NEEDS, englishLanguageName, isKnownLanguage, labelFor, TRAININGS } from './options';
import type { ProfileDraft } from './types';

type NamedLanguage = keyof Resources['profile']['languageNames'];

/** A language's name in the UI language, e.g. 'es' → "Spanish" (en), "español" (es); unknown codes as stored. */
export function uiLanguageName(code: string): string {
  if (!isKnownLanguage(code)) return code;
  return i18n.t(`profile:languageNames.${code as NamedLanguage}`, { defaultValue: englishLanguageName(code) });
}

/**
 * The tags the other side of a help request sees, in the UI language, e.g.
 * visitor → ["Speaks Spanish, English", "Wheelchair user"]
 * volunteer → ["Speaks English, Spanish", "Wheelchair trained"]
 * Main language first. Kept in one place so the privacy policy and the preview card stay true.
 */
export function helperSummary(d: Pick<ProfileDraft, 'role' | 'languages' | 'mainLanguage' | 'accessNeeds' | 'communication' | 'trainings'>): string[] {
  const langs = [d.mainLanguage, ...d.languages.filter(l => l !== d.mainLanguage)]
    .filter(l => d.languages.includes(l))
    .map(uiLanguageName);
  const tags = langs.length ? [i18n.t('profile:summary.speaks', { languages: langs.join(i18n.t('profile:summary.listSeparator')) })] : [];

  if (d.role === 'visitor') {
    tags.push(...d.accessNeeds.filter(n => n !== 'other').map(n => labelFor(ACCESS_NEEDS, n)));
    if (d.accessNeeds.includes('other')) tags.push(i18n.t('profile:summary.otherNeeds'));
    tags.push(...d.communication.filter(c => c !== 'speaking').map(c => i18n.t(`profile:summary.prefers.${c}`)));
  } else {
    tags.push(...d.trainings.map(t => labelFor(TRAININGS, t)));
  }
  return tags;
}

export function initials(firstName: string): string {
  const parts = firstName.trim().split(/\s+/).filter(Boolean);
  // Array.from splits by code point, so "😀 Rosa" gives "😀R", not half an emoji.
  return parts.slice(0, 2).map(p => Array.from(p)[0]!.toUpperCase()).join('') || '?';
}
