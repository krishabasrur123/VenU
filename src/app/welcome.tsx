import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LogoMark } from '@/components/wordmark';
import { Colors, Face, Radius, Shadow, Spacing, Type } from '@/constants/theme';
import { WelcomeLanguagePill } from '@/features/auth/auth-ui';
import { OnboardingScreen, PrimaryAction } from '@/features/auth/onboarding-screen';
import { readPendingSetup, rememberPendingRole } from '@/features/auth/pending-setup';
import { useSignedInHref } from '@/features/auth/use-auth-form';
import type { Role } from '@/features/profile/types';
import { useT } from '@/i18n';

const ROLES: Role[] = ['visitor', 'volunteer'];

/**
 * First screen for signed-out users (Figma role choice 530:10212): visitor or volunteer, then
 * the landing page (Create Account / Sign In). The choice is kept for setup, which then skips its
 * own role question; it doesn't change an account that already has a profile.
 */
export default function WelcomeScreen() {
  const signedInHref = useSignedInHref();
  const t = useT('onboarding');
  const tc = useT('common');
  // Set by Profile -> Delete my data: 'account' (all gone) or 'dataOnly' (the sign-in remains).
  const { deleted } = useLocalSearchParams<{ deleted?: string }>();
  const [role, setRole] = useState<Role | null>(null);

  // Coming back here (Back from the landing page, or a reload): show the earlier choice.
  useEffect(() => {
    let live = true;
    readPendingSetup().then(p => { if (live && p.role) setRole(r => r ?? p.role!); });
    return () => { live = false; };
  }, []);

  // Opening /welcome while signed in (a bookmark, another tab): move on.
  if (signedInHref) return <Redirect href={signedInHref} />;

  async function next() {
    if (!role) return;
    await rememberPendingRole(role);
    router.push('/landing');
  }

  return (
    <OnboardingScreen
      pill={<WelcomeLanguagePill />}
      actions={<PrimaryAction label={tc('actions.continue')} onPress={() => void next()} disabled={!role} />}>
      <View style={styles.hero}>
        <LogoMark size={100} />
        <Text style={styles.name} accessibilityRole="header">VenU</Text>
      </View>

      {(deleted === 'account' || deleted === 'dataOnly') && (
        <Text style={styles.deleted} accessibilityLiveRegion="polite">
          {deleted === 'account' ? t('welcome.accountDeleted') : t('welcome.signInKept')}
        </Text>
      )}

      <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel={t('welcome.roleQuestion')}>
        {ROLES.map((r, i) => {
          const on = role === r;
          return (
            <View key={r} style={styles.choiceWrap}>
              {i > 0 && <Text style={styles.or}>{t('welcome.or')}</Text>}
              <Pressable
                onPress={() => setRole(r)}
                style={({ pressed }) => [styles.choice, on && styles.choiceOn, pressed && !on && styles.choicePressed]}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                // react-native-web reads only aria-* for state.
                aria-checked={on}>
                <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{t(r === 'visitor' ? 'welcome.visitor' : 'welcome.volunteer')}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  // Figma 530:10212: the logo sits about 160pt from the top, the cards 72pt under "VenU".
  hero: { alignItems: 'center', marginTop: 100, gap: Spacing.xl },
  name: { ...Face.displaySemiBold, fontSize: 25, lineHeight: 30, color: Colors.text },
  deleted: { ...Type.caption, textAlign: 'center', marginTop: Spacing.xl, marginBottom: -Spacing.xxl },
  choices: { alignItems: 'center', marginTop: 72 },
  choiceWrap: { alignItems: 'center', gap: Spacing.md, marginTop: Spacing.md },
  or: { ...Type.body },
  // Figma "Frame 2283": cream card, 2px blue outline; chosen, it fills ink (the 473:31613 variant).
  choice: {
    width: 260,
    maxWidth: '100%',
    minHeight: 93,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: Colors.gradientTop,
    ...Shadow.card,
  },
  choiceOn: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  choicePressed: { backgroundColor: Colors.primarySoft },
  choiceText: { ...Type.body, textAlign: 'center' },
  choiceTextOn: { color: Colors.onPrimary },
});
