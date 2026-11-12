// Right-to-left layout for Arabic and Persian, per the Expo localization guide.
// Web: <html dir lang> flips flex rows and start/end styles at once.
// Native: I18nManager only takes effect after a reload, so we set it and ask to restart.
// (Expo Go resets RTL on every launch, so native RTL needs a development or store build.)

import { Alert, DevSettings, I18nManager, Platform } from 'react-native';

import i18n from './index';
import { isRtl } from './languages';

/** The direction already requested this session, so the restart prompt shows once per change. */
let requestedRtl: boolean | null = null;

export function applyDirection(language: string): void {
  const rtl = isRtl(language);
  if (Platform.OS === 'web') {
    if (typeof document === 'undefined') return; // static rendering
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    return;
  }
  if (I18nManager.isRTL === rtl || requestedRtl === rtl) return;
  requestedRtl = rtl;
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  promptRestart();
}

function promptRestart() {
  const t = i18n.t.bind(i18n);
  // A release build can't restart itself without expo-updates; the new layout applies on next launch.
  const buttons = __DEV__
    ? [
        { text: t('direction.later'), style: 'cancel' as const },
        { text: t('direction.restartNow'), onPress: () => DevSettings.reload() },
      ]
    : [{ text: t('direction.ok') }];
  Alert.alert(t('direction.restartTitle'), t('direction.restartBody'), buttons);
}
