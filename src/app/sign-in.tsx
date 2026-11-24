import { Redirect, useLocalSearchParams } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, Spacing, Type } from '@/constants/theme';
import { AuthScreen } from '@/features/auth/auth-screen';
import { AuthField, FooterPrompt } from '@/features/auth/auth-ui';
import { PrimaryAction } from '@/features/auth/onboarding-screen';
import { useAuthForm, useSignedInHref } from '@/features/auth/use-auth-form';
import { useT } from '@/i18n';
import { resendConfirmation } from '@/lib/auth';

/** Figma Sign In (Onboarding 2.0, 482:32247). The "Username" field takes a username or an email. */
export default function SignInScreen() {
  // Set by Create Account when Supabase wants the email confirmed first.
  const params = useLocalSearchParams<{ confirm?: string; email?: string }>();
  const signedInHref = useSignedInHref();
  const t = useT('onboarding');
  const { busy, error, errorFor, submit } = useAuthForm('signin');
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [forgotNote, setForgotNote] = useState(false);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [showConfirm, setShowConfirm] = useState(params.confirm === '1');
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  // Signed in (just now, in another tab, or by opening /sign-in while signed in): move on.
  if (signedInHref) return <Redirect href={signedInHref} />;

  const notice = showConfirm && !error ? t('signIn.confirmNotice') : null;

  const go = async () => {
    const result = await submit({ email, password });
    if (result === 'confirm') {
      setShowConfirm(true);
      setResendState('idle');
    }
  };

  async function handleResend() {
    if (!email || resendState === 'sending' || resendState === 'sent') return;
    setResendState('sending');
    const result = await resendConfirmation(email);
    setResendState(result.ok ? 'sent' : 'error');
  }

  return (
    <AuthScreen title={t('signIn.title')} footer={<FooterPrompt text={t('signIn.noAccount')} action={t('signIn.signUp')} href="/sign-up" />}>
      <View style={styles.form}>
        <AuthField
          label={t('auth.username')}
          placeholder={t('signIn.identifierPlaceholder')}
          value={email}
          onChangeText={setEmail}
          error={errorFor('email')}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <AuthField
          ref={passwordRef}
          label={t('auth.password')}
          placeholder={t('auth.passwordPlaceholder')}
          value={password}
          onChangeText={setPassword}
          error={errorFor('password')}
          secure
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={go}
        />
        <View style={styles.forgotRow}>
          <Pressable onPress={() => setForgotNote(true)} style={styles.linkTarget} accessibilityRole="link">
            <Text style={styles.link}>{t('signIn.forgot')}</Text>
          </Pressable>
        </View>
        {forgotNote && (
          <Text style={Type.caption} accessibilityLiveRegion="polite">{t('signIn.forgotSoon')}</Text>
        )}
      </View>

      {error?.field === null && <Text style={styles.error} accessibilityLiveRegion="polite">{error.message}</Text>}
      {notice && (
        <View style={styles.confirmBox}>
          <Text style={styles.notice} accessibilityLiveRegion="polite">{notice}</Text>
          <Pressable
            onPress={handleResend}
            disabled={resendState === 'sending' || resendState === 'sent'}
            style={styles.resendBtn}
            accessibilityRole="button">
            <Text style={[styles.resendLabel, resendState === 'sent' && styles.resendLabelSent]}>
              {resendState === 'sending'
                ? '...'
                : resendState === 'sent'
                ? t('signIn.resendSent')
                : resendState === 'error'
                ? t('signIn.resendError')
                : t('signIn.resend')}
            </Text>
          </Pressable>
        </View>
      )}

      <View style={styles.cta}>
        <PrimaryAction label={t('signIn.submit')} onPress={go} loading={busy} />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.gutter },
  forgotRow: { flexDirection: 'row', marginTop: -Spacing.sm },
  linkTarget: { minHeight: 44, justifyContent: 'center' },
  link: { ...Type.body, color: Colors.primary, textDecorationLine: 'underline' },
  error: { ...Type.caption, color: Colors.danger, textAlign: 'center', marginTop: Spacing.lg },
  notice: { ...Type.caption, color: Colors.success, textAlign: 'center', marginTop: Spacing.lg },
  confirmBox: { alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.lg },
  resendBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  resendLabel: { ...Type.caption, color: Colors.primary, textDecorationLine: 'underline' },
  resendLabelSent: { color: Colors.success, textDecorationLine: 'none' },
  cta: { alignItems: 'center', marginTop: Spacing.xxl },
});
