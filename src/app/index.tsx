import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { LogoMark } from '@/components/wordmark';
import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import { useProfile } from '@/features/profile/profile-context';
import { homeFor } from '@/features/profile/types';
import { useT } from '@/i18n';
import { OFFLINE } from '@/lib/errors';

/** Entry gate: signed out → landing (/welcome), signed in without a profile → onboarding, else the role's home tab. */
export default function Index() {
  const { status, loadError, profile, refresh, signOut } = useProfile();
  const [busy, setBusy] = useState<'retry' | 'signout' | null>(null);
  const t = useT('onboarding');
  const tc = useT('common');

  if (status === 'loading') return null;
  if (status === 'signedOut') return <Redirect href="/welcome" />;
  if (status === 'error') {
    const offline = loadError === OFFLINE;
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <LogoMark size={80} />
          <Text style={styles.title} accessibilityRole="header">
            {offline ? t('gate.offlineTitle') : t('gate.errorTitle')}
          </Text>
          <Text style={styles.body} accessibilityLiveRegion="polite">
            {offline ? t('gate.offlineBody') : loadError}
          </Text>
          <View style={styles.actions}>
            <Button
              label={tc('actions.tryAgain')}
              variant="dark"
              loading={busy === 'retry'}
              style={styles.action}
              onPress={() => {
                setBusy('retry');
                refresh().catch(() => {}).finally(() => setBusy(null));
              }}
            />
            {/* A way out when retrying keeps failing (e.g. a broken saved profile). */}
            <Button
              label={tc('actions.signOut')}
              variant="secondary"
              loading={busy === 'signout'}
              style={styles.action}
              onPress={() => {
                setBusy('signout');
                signOut().catch(() => {}).finally(() => setBusy(null));
              }}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }
  return <Redirect href={profile ? homeFor(profile) : '/onboarding/role'} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xxl },
  title: { fontFamily: Fonts.display, fontSize: 24, lineHeight: 30, color: Colors.text, textAlign: 'center', marginTop: Spacing.md },
  body: { ...Type.body, color: Colors.textMuted, textAlign: 'center' },
  actions: { alignItems: 'center', gap: Spacing.md, marginTop: Spacing.lg },
  action: { width: 240 },
});
