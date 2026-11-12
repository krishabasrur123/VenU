// Keeps i18next on the right language; mounted once in app/_layout.tsx, renders nothing.
// Priority: signed-in profile's appLanguage → welcome-screen pick (pending setup) → device → English.
// e.g. signed out, picked 한국어 on welcome → Korean; signs in as Rosa (appLanguage 'es') → Spanish.

import { useLocales } from 'expo-localization';
import { usePathname } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useProfile } from '@/features/profile/profile-context';

import { applyDirection } from './direction';
import i18n from './index';
import { pickUiLanguage } from './languages';
import { refreshPendingLanguage, usePendingLanguage } from './pending-language';

export function LanguageSync() {
  const { status, profile } = useProfile();
  const pending = usePendingLanguage();
  const device = useLocales()[0]?.languageCode; // re-renders when the OS language changes
  const pathname = usePathname();

  // The welcome pill writes pending setup straight to storage, so re-read it on each route change
  // and on returning to the app.
  useEffect(() => {
    refreshPendingLanguage();
  }, [pathname]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => s === 'active' && refreshPendingLanguage());
    return () => sub.remove();
  }, []);

  // Wait for the profile and stored pick, so a device language never flashes in (or asks for an RTL restart) first.
  const settled = status !== 'loading' && pending.loaded;
  const language = pickUiLanguage({
    profile: status === 'ready' ? profile?.appLanguage : null,
    pending: pending.language,
    device,
  });

  useEffect(() => {
    if (!settled) return;
    if (i18n.language !== language) i18n.changeLanguage(language);
    applyDirection(language);
  }, [settled, language]);

  return null;
}
