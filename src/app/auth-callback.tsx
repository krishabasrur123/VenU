import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Type } from '@/constants/theme';
import { WelcomeLanguagePill } from '@/features/auth/auth-ui';
import { OnboardingScreen, PrimaryAction } from '@/features/auth/onboarding-screen';
import { takeOpeningUrl } from '@/features/auth/opening-url';
import { clearPendingName } from '@/features/auth/pending-setup';
import { useSignedInHref } from '@/features/auth/use-auth-form';
import { useProfile } from '@/features/profile/profile-context';
import { useT } from '@/i18n';
import { completeOAuthRedirect } from '@/lib/account';
import { friendlyError } from '@/lib/errors';

/**
 * Where Facebook / Google / Apple sign-in comes back to (…/auth-callback#access_token=…). Stores the
 * session, then on like any sign-in: a new account to setup (its role step, or straight to languages
 * when the first screen's choice is kept), an existing one to its home tab.
 */
export default function AuthCallbackScreen() {
  const t = useT('onboarding');
  const tc = useT('common');
  const { refresh } = useProfile();
  const signedInHref = useSignedInHref();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const result = await completeOAuthRedirect(takeOpeningUrl());
      if (!result.ok) throw result.error;
      // Already set up: the name and role kept for setup are spent (as after a password sign-in).
      if (await refresh()) await clearPendingName();
    })()
      .then(() => live && setDone(true))
      .catch(e => live && setError(typeof e === 'string' ? e : friendlyError(e)));
    return () => {
      live = false;
    };
  }, [refresh]);

  // Only once this sign-in is stored: before that, a session already on this device would win.
  if (done && signedInHref) return <Redirect href={signedInHref} />;

  return (
    <OnboardingScreen
      pill={<WelcomeLanguagePill />}
      title={error ? t('social.failedTitle') : undefined}
      centered
      actions={error ? <PrimaryAction label={tc('actions.back')} onPress={() => router.replace('/landing')} /> : undefined}>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>
      ) : (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.ink} size="large" />
          <Text style={Type.body} accessibilityLiveRegion="polite">{t('social.signingIn')}</Text>
        </View>
      )}
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: Spacing.lg, marginTop: 160 },
  error: { ...Type.body, textAlign: 'center' },
});
