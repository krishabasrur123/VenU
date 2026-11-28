import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Type } from '@/constants/theme';
import { AuthField, FooterPrompt } from '@/features/auth/auth-ui';
import { AuthScreen } from '@/features/auth/auth-screen';
import { PrimaryAction } from '@/features/auth/onboarding-screen';
import { resetIdentifierError } from '@/features/auth/validate';
import { useT } from '@/i18n';
import { requestPasswordReset } from '@/lib/account';
import { friendlyError } from '@/lib/errors';

/**
 * Forgot Password (from Sign In's "Forgot Password?", Figma 482:32247; no frame of its own, so it
 * follows Sign In). Takes a username or an email and always answers the same way, so it can't be
 * used to find out who has an account.
 */
export default function ForgotPasswordScreen() {
  // Whatever was typed in Sign In's Username field.
  const params = useLocalSearchParams<{ identifier?: string }>();
  const t = useT('onboarding');
  const [identifier, setIdentifier] = useState(params.identifier ?? '');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  async function send() {
    if (inFlight.current) return;
    const invalid = resetIdentifierError(identifier);
    setFieldError(invalid);
    setError(null);
    if (invalid) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const result = await requestPasswordReset(identifier);
      if (result.ok) setSent(true);
      else setError(result.error);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <AuthScreen
      title={t('forgot.title')}
      subtitle={t('forgot.intro')}
      footer={<FooterPrompt text={t('forgot.remembered')} action={t('signUp.signIn')} href="/sign-in" />}>
      <AuthField
        label={t('forgot.identifier')}
        placeholder={t('signIn.identifierPlaceholder')}
        value={identifier}
        onChangeText={v => {
          setIdentifier(v);
          setSent(false);
        }}
        error={fieldError}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        returnKeyType="send"
        onSubmitEditing={() => void send()}
      />

      {error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
      {sent && <Text style={styles.notice} accessibilityLiveRegion="polite">{t('forgot.sent')}</Text>}

      <View style={styles.cta}>
        <PrimaryAction label={sent ? t('forgot.resend') : t('forgot.submit')} onPress={() => void send()} loading={busy} />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  error: { ...Type.caption, color: Colors.danger, textAlign: 'center', marginTop: Spacing.lg },
  notice: { ...Type.caption, color: Colors.success, textAlign: 'center', marginTop: Spacing.lg },
  cta: { alignItems: 'center', marginTop: Spacing.xxl },
});
