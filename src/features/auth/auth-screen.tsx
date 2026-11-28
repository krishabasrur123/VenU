import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Type } from '@/constants/theme';
import { useT } from '@/i18n';
import { isLocalMode } from '@/lib/auth';

import { WelcomeLanguagePill } from './auth-ui';
import { OnboardingScreen } from './onboarding-screen';

/**
 * Sign In / Create Account (Figma 482:32247 / 482:32140), and Forgot / New Password in the same
 * style: centred title (and an optional line under it), the form and its button,
 * and a footer prompt pinned to the bottom ("Don't have an account? Sign Up").
 */
export function AuthScreen({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer: ReactNode }) {
  const t = useT('onboarding');
  return (
    <OnboardingScreen
      pill={<WelcomeLanguagePill />}
      title={title}
      subtitle={subtitle}
      centered
      actions={
        <>
          {footer}
          {isLocalMode && <Text style={styles.localNote}>{t('auth.devMode')}</Text>}
        </>
      }>
      {children}
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  localNote: { ...Type.caption, textAlign: 'center', marginTop: -8 },
});
