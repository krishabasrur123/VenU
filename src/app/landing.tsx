import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { LogoMark } from '@/components/wordmark';
import { Colors, Face, Spacing, Type } from '@/constants/theme';
import type { OAuthProvider } from '@/features/auth/auth-redirect';
import { SocialButtons, WelcomeLanguagePill } from '@/features/auth/auth-ui';
import { OnboardingScreen } from '@/features/auth/onboarding-screen';
import { useSignedInHref } from '@/features/auth/use-auth-form';
import { useProfile } from '@/features/profile/profile-context';
import { useT } from '@/i18n';
import { signInWithProvider } from '@/lib/account';
import { friendlyError } from '@/lib/errors';

/** After the visitor/volunteer choice (Figma Onboarding 2.0, 482:31962): Create Account or Sign In. */
export default function LandingScreen() {
  const signedInHref = useSignedInHref();
  const t = useT('onboarding');
  const { refresh } = useProfile();
  const [socialError, setSocialError] = useState<string | null>(null);
  const [busy, setBusy] = useState<OAuthProvider | null>(null);

  if (signedInHref) return <Redirect href={signedInHref} />;

  // Web leaves for the provider (and /auth-callback finishes); a phone finishes here, and the
  // redirect above moves on once the profile has loaded.
  async function social(provider: OAuthProvider) {
    if (busy) return;
    setBusy(provider);
    setSocialError(null);
    try {
      const result = await signInWithProvider(provider);
      if (!result.ok) {
        if ('error' in result) setSocialError(result.error);
      } else if (!result.leaving) {
        await refresh();
      }
    } catch (e) {
      setSocialError(friendlyError(e));
    } finally {
      // Also when leaving: coming Back from the provider can restore this page as it was.
      setBusy(null);
    }
  }

  return (
    <OnboardingScreen pill={<WelcomeLanguagePill />}>
      <View style={styles.hero}>
        <LogoMark size={100} />
        <Text style={styles.name} accessibilityRole="header">VenU</Text>
      </View>

      <View style={styles.actions}>
        <Button label={t('welcome.createAccount')} variant="secondary" onPress={() => router.push('/sign-up')} style={styles.action} />
        <Text style={styles.or}>{t('welcome.or')}</Text>
        <Button label={t('welcome.signIn')} onPress={() => router.push('/sign-in')} style={styles.action} />
      </View>

      <View style={styles.social}>
        <Text style={styles.socialTitle}>{t('welcome.socialTitle')}</Text>
        <SocialButtons onPress={p => void social(p)} busy={busy} />
        {socialError && (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {socialError}
          </Text>
        )}
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginTop: 72, gap: Spacing.lg },
  name: { ...Face.displaySemiBold, fontSize: 25, lineHeight: 30, color: Colors.text },
  actions: { alignItems: 'center', marginTop: 72, gap: Spacing.lg },
  // Figma's 260x93 cards, a little shorter so the social row fits a 390pt screen.
  action: { width: 260, maxWidth: '100%', minHeight: 72 },
  or: { ...Type.body },
  social: { alignItems: 'center', marginTop: 48, gap: Spacing.lg },
  socialTitle: { ...Type.body, color: Colors.textFaint },
  error: { ...Type.caption, color: Colors.danger, textAlign: 'center' },
});
