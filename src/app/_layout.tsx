import { AlbertSans_400Regular, AlbertSans_500Medium, AlbertSans_600SemiBold, AlbertSans_700Bold } from '@expo-google-fonts/albert-sans';
import { Alexandria_400Regular, Alexandria_500Medium, Alexandria_600SemiBold } from '@expo-google-fonts/alexandria';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { WEB_COLUMN_MAX } from '@/constants/theme';
import { ProfileProvider } from '@/features/profile/profile-context';
import { VolunteerSessionReset } from '@/features/volunteer/session-reset';
import { LanguageSync } from '@/i18n/language-sync';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Names must match Fonts in constants/theme.ts.
  const [fontsLoaded, fontError] = useFonts({
    Alexandria_400Regular, Alexandria_500Medium, Alexandria_600SemiBold,
    AlbertSans_400Regular, AlbertSans_500Medium, AlbertSans_600SemiBold, AlbertSans_700Bold,
  });
  const ready = fontsLoaded || !!fontError; // a font that fails to load falls back to the system font
  // The column's edge lines only make sense when there's backdrop beside it; on a phone they're stray lines.
  const framed = useWindowDimensions().width > WEB_COLUMN_MAX;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <WebSafeArea>
      <ProfileProvider>
        <LanguageSync />
        {/* Drops a volunteer request when its user signs out or someone else signs in. */}
        <VolunteerSessionReset />
        {/* Web only: keep the phone layout in a centred column instead of stretching across a desktop screen. */}
        <View style={styles.backdrop}>
          <View style={[styles.column, framed && styles.columnFramed]}>
            <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
              {/* index decides: sign-in → onboarding (no profile yet) → (tabs) */}
              <Stack.Screen name="index" />
              <Stack.Screen name="sign-in" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="edit-profile" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="privacy" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            </Stack>
          </View>
        </View>
      </ProfileProvider>
    </WebSafeArea>
  );
}

/**
 * On web, Expo Router reports zero safe-area insets, so in a phone browser the screens ran under the
 * status bar and home indicator. This provider reads the browser's real insets (env(safe-area-inset-*))
 * instead. Native already gets real insets from Expo Router, so it's a pass-through there.
 */
function WebSafeArea({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== 'web') return children;
  return <SafeAreaProvider>{children}</SafeAreaProvider>;
}

const styles = StyleSheet.create({
  backdrop: Platform.select({
    web: { flex: 1, backgroundColor: '#E6E8EC', alignItems: 'center' },
    default: { flex: 1 },
  }),
  column: Platform.select({
    web: {
      flex: 1,
      width: '100%',
      maxWidth: WEB_COLUMN_MAX,
      overflow: 'hidden',
    },
    default: { flex: 1 },
  }),
  // Hairline edges so the column reads as "the app" on a wide screen.
  columnFramed: Platform.select({
    web: { borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, borderColor: '#D5D8DE' },
    default: {},
  }),
});
