// The app's translator. Screens call useT(namespace); plain functions (e.g. lib/errors.ts) call i18n.t.
// e.g. const t = useT('venue'); <Text>{t('report.submitted', { date: formatDate(report.createdAt) })}</Text>
// The language itself is set by <LanguageSync /> (mounted in app/_layout.tsx), never by screens.

import { createInstance } from 'i18next';
import { I18nManager, Platform } from 'react-native';
import { initReactI18next, useTranslation } from 'react-i18next';

import { DEFAULT_LANGUAGE, isRtl, resolveUiLanguage, type UiLanguage } from './languages';
import { NAMESPACES, resources, type Namespace } from './locales';

export { NAMESPACES, type Namespace } from './locales';
export { DEFAULT_LANGUAGE, UI_LANGUAGES, isRtl, isUiLanguage, resolveUiLanguage, type UiLanguage } from './languages';

const i18n = createInstance();

i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE, // a key missing in a translation shows the English text
  supportedLngs: Object.keys(resources),
  ns: [...NAMESPACES],
  defaultNS: 'common',
  initAsync: false, // tables are bundled, so t() works as soon as this module loads
  interpolation: { escapeValue: false }, // React already escapes text
  react: { useSuspense: false },
  // Dev only: a key that English doesn't have either prints a warning naming it.
  saveMissing: __DEV__,
  missingKeyHandler: (lngs, ns, key) => console.warn(`[i18n] Missing string "${ns}:${key}" (${lngs.join(', ')})`),
});

export default i18n;

/**
 * Translator for one namespace; re-renders when the language changes.
 * e.g. const t = useT('common'); t('actions.save') → "Guardar" in Spanish
 */
export function useT<N extends Namespace>(ns: N) {
  return useTranslation(ns).t;
}

/** The current UI language and its text direction, e.g. { language: 'ar', rtl: true }. Re-renders on change. */
export function useUiLanguage(): { language: UiLanguage; rtl: boolean } {
  const { i18n: current } = useTranslation();
  const language = resolveUiLanguage(current.language);
  return { language, rtl: isRtl(language) };
}

/**
 * Whether the layout is mirrored right now. Flip arrows and chevrons with it:
 * e.g. const rtl = useLayoutRtl();
 *      <View style={rtl && { transform: [{ scaleX: -1 }] }}><FigmaIcon name="arrow-left" size={24} /></View>
 * Native layout only flips after a restart, so there it follows I18nManager, not the language.
 */
export function useLayoutRtl(): boolean {
  const { rtl } = useUiLanguage();
  return Platform.OS === 'web' ? rtl : I18nManager.isRTL;
}
