import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, Spacing, Type } from '@/constants/theme';
import { parseAuthRedirect, type AuthRedirect } from '@/features/auth/auth-redirect';
import { AuthField, FooterPrompt } from '@/features/auth/auth-ui';
import { AuthScreen } from '@/features/auth/auth-screen';
import { PrimaryAction } from '@/features/auth/onboarding-screen';
import { takeOpeningUrl } from '@/features/auth/opening-url';
import { newPasswordError } from '@/features/auth/validate';
import { useT } from '@/i18n';
import { setPasswordFromLink } from '@/lib/account';
import { friendlyError } from '@/lib/errors';

/**
 * New Password: where the reset email's link lands (…/reset-password#access_token=…&type=recovery).
 * The new password follows the Create Account rule; saving it signs out everywhere, then Sign In
 * says so. An expired or used link offers a new one.
 */
export default function ResetPasswordScreen() {
  const t = useT('onboarding');
  const [link, setLink] = useState<AuthRedirect | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldError, setFieldError] = useState<{ field: 'password' | 'confirm'; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const confirmRef = useRef<ComponentRef<typeof TextInput>>(null);

  // Read once, after the first render (the web build renders this page without a window first).
  useEffect(() => {
    let live = true;
    const opened = parseAuthRedirect(takeOpeningUrl());
    Promise.resolve().then(() => live && setLink(opened));
    return () => {
      live = false;
    };
  }, []);

  async function save() {
    if (inFlight.current || link?.kind !== 'session') return;
    const invalid = newPasswordError(password, confirm);
    setFieldError(invalid);
    setError(null);
    if (invalid) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const result = await setPasswordFromLink(link, password);
      if (result.ok) router.replace({ pathname: '/sign-in', params: { reset: '1' } });
      else setError(result.error);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const footer = <FooterPrompt text={t('forgot.remembered')} action={t('signUp.signIn')} href="/sign-in" />;

  if (!link) {
    return (
      <AuthScreen title={t('reset.title')} footer={footer}>
        <ActivityIndicator color={Colors.ink} accessibilityLabel={t('reset.checking')} />
      </AuthScreen>
    );
  }

  if (link.kind !== 'session') {
    // An expired, used or broken link (Auth's error_code, e.g. otp_expired), or no link at all.
    const message = link.kind === 'error' ? friendlyError({ code: link.code, message: link.description }, t('reset.badLink')) : t('reset.noLink');
    return (
      <AuthScreen title={t('reset.title')} footer={footer}>
        <Text style={styles.problem} accessibilityLiveRegion="polite">{message}</Text>
        <View style={styles.cta}>
          <PrimaryAction label={t('reset.newLink')} onPress={() => router.replace('/forgot-password')} />
        </View>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title={t('reset.title')} subtitle={t('reset.intro')} footer={footer}>
      <View style={styles.form}>
        <AuthField
          label={t('reset.password')}
          placeholder={t('reset.passwordPlaceholder')}
          value={password}
          onChangeText={setPassword}
          error={fieldError?.field === 'password' ? fieldError.message : null}
          secure
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
        />
        <AuthField
          ref={confirmRef}
          label={t('reset.confirm')}
          placeholder={t('reset.confirmPlaceholder')}
          value={confirm}
          onChangeText={setConfirm}
          error={fieldError?.field === 'confirm' ? fieldError.message : null}
          secure
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={() => void save()}
        />
      </View>

      {error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}

      <View style={styles.cta}>
        <PrimaryAction label={t('reset.submit')} onPress={() => void save()} loading={busy} />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.gutter },
  problem: { ...Type.body, textAlign: 'center' },
  error: { ...Type.caption, color: Colors.danger, textAlign: 'center', marginTop: Spacing.lg },
  cta: { alignItems: 'center', marginTop: Spacing.xxl },
});
