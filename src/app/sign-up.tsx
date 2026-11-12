import { Redirect, router } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { Trans } from 'react-i18next';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Colors, Spacing, Type } from '@/constants/theme';
import { AuthField, Checkbox, FooterPrompt } from '@/features/auth/auth-ui';
import { AuthScreen } from '@/features/auth/auth-screen';
import { useAuthForm, useSignedInHref } from '@/features/auth/use-auth-form';
import { FIRST_NAME_MAX } from '@/features/profile/validate';
import { useT } from '@/i18n';

/**
 * Figma onboarding__create-account. No "Username" field: accounts are email + password and
 * there's nowhere to store one. The name pre-fills the first name in profile setup.
 */
export default function SignUpScreen() {
  const signedInHref = useSignedInHref();
  const t = useT('onboarding');
  const { busy, error, errorFor, setError, submit } = useAuthForm('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  // Signed in (just now, or by opening /sign-up while signed in): on to setup or home.
  if (signedInHref) return <Redirect href={signedInHref} />;

  async function go() {
    const result = await submit({ name, email, password, termsAccepted: terms });
    if (result === 'confirm') router.replace({ pathname: '/sign-in', params: { confirm: '1', email: email.trim() } });
  }

  return (
    <AuthScreen title={t('signUp.title')} footer={<FooterPrompt text={t('signUp.haveAccount')} action={t('signUp.signIn')} href="/sign-in" />}>
      <View style={styles.form}>
        <AuthField
          label={t('auth.name')}
          placeholder={t('auth.namePlaceholder')}
          value={name}
          onChangeText={setName}
          maxLength={FIRST_NAME_MAX}
          autoComplete="given-name"
          textContentType="givenName"
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
        />
        <AuthField
          ref={emailRef}
          label={t('auth.email')}
          placeholder={t('auth.emailPlaceholder')}
          value={email}
          onChangeText={setEmail}
          error={errorFor('email')}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
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
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={go}
        />
        <Checkbox
          checked={terms}
          onToggle={() => {
            setTerms(t => !t);
            if (error?.field === 'terms') setError(null);
          }}
          error={errorFor('terms')}
          accessibilityLabel={t('signUp.agreeLabel')}>
          <Text style={Type.body}>
            <Trans
              t={t}
              i18nKey="signUp.agree"
              components={{ a: <Text style={styles.link} onPress={() => router.push('/terms')} accessibilityRole="link" /> }}
            />
          </Text>
        </Checkbox>
      </View>

      {error?.field === null && <Text style={styles.error} accessibilityLiveRegion="polite">{error.message}</Text>}

      <Button label={t('signUp.submit')} variant="dark" onPress={go} loading={busy} style={styles.cta} />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.gutter },
  link: { color: Colors.primary, textDecorationLine: 'underline' },
  error: { ...Type.caption, color: Colors.danger, textAlign: 'center', marginTop: Spacing.lg },
  cta: { alignSelf: 'center', width: 240, marginTop: Spacing.lg },
});
