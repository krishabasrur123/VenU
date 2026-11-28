/**
 * The Onboarding 2.0 page (Figma 473:31894, 530:10212): the cream-to-blue gradient with its soft
 * shapes, the language pill in the top corner, a semibold title (start-aligned for setup steps, centred on Create Account / Sign In),
 * the content, and the actions pinned to the bottom (a dark 265pt button, a footer prompt).
 * e.g. <OnboardingScreen pill={<WelcomeLanguagePill />} title="Choose your languages"
 *        subtitle="To help you communicate with volunteers." actions={<PrimaryAction … />}>…</OnboardingScreen>
 */
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { PageGradient } from '@/components/page-gradient';
import { Colors, Face, Fonts, Spacing } from '@/constants/theme';

interface OnboardingScreenProps {
  /** The corner language pill (signed out: WelcomeLanguagePill; during setup: AppLanguagePill). */
  pill: ReactNode;
  /** Shown opposite the pill on setup steps, e.g. <BackLink fallback="/onboarding/languages" />. */
  back?: ReactNode;
  title?: string;
  subtitle?: string;
  /** Create Account and Sign In centre their title; setup steps start it at the leading edge. */
  centered?: boolean;
  children: ReactNode;
  /** Pinned under the content: the main button, then e.g. "Already have an account? Sign In". */
  actions?: ReactNode;
}

export function OnboardingScreen({ pill, back, title, subtitle, centered = false, children, actions }: OnboardingScreenProps) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <PageGradient shapes />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.topRow}>
            <View>{back}</View>
            {pill}
          </View>
          {title ? (
            <View style={[styles.header, centered && styles.headerCentered, back ? styles.headerUnderBack : null]}>
              <Text style={[styles.title, centered && styles.centerText]} accessibilityRole="header">{title}</Text>
              {subtitle ? <Text style={[styles.subtitle, centered && styles.centerText]}>{subtitle}</Text> : null}
            </View>
          ) : null}
          {children}
          <View style={styles.spacer} />
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Figma's dark "Continue" / "Create Account" / "Finish Setup" button: 265pt wide, 50 tall, centred. */
export function PrimaryAction({ label, onPress, loading, disabled }: { label: string; onPress: () => void; loading?: boolean; disabled?: boolean }) {
  return <Button label={label} variant="dark" onPress={onPress} loading={loading} disabled={disabled} style={styles.primary} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.gradientTop },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.gutter, paddingBottom: Spacing.xl },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: Spacing.md, minHeight: 44 },
  header: { gap: Spacing.sm, marginTop: 56, marginBottom: Spacing.xxl },
  headerUnderBack: { marginTop: Spacing.xxl },
  headerCentered: { alignItems: 'center', marginTop: 72 },
  title: { ...Face.displaySemiBold, fontSize: 25, lineHeight: 30, color: Colors.text },
  subtitle: { fontFamily: Fonts.text, fontSize: 13, lineHeight: 17, color: Colors.text },
  centerText: { textAlign: 'center' },
  spacer: { flexGrow: 1, minHeight: Spacing.xl },
  actions: { alignItems: 'center', gap: Spacing.lg },
  primary: { width: 265, maxWidth: '100%', minHeight: 50 },
});
