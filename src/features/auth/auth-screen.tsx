import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LogoMark } from '@/components/wordmark';
import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import { useT } from '@/i18n';
import { isLocalMode } from '@/lib/auth';

/**
 * Sign In / Create Account layout: logo tile, centred title, the form, and a footer prompt
 * pinned to the bottom ("Don't have an account? Sign Up").
 */
export function AuthScreen({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  const t = useT('onboarding');
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <LogoMark size={104} />
            <Text style={styles.title} accessibilityRole="header">{title}</Text>
          </View>
          {children}
          <View style={styles.spacer} />
          <View style={styles.footer}>
            {footer}
            {isLocalMode && (
              <Text style={styles.localNote}>{t('auth.devMode')}</Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.gutter, paddingTop: Spacing.xl, paddingBottom: Spacing.lg },
  hero: { alignItems: 'center', gap: Spacing.lg, marginBottom: Spacing.xl },
  title: { fontFamily: Fonts.display, fontSize: 28, lineHeight: 34, color: Colors.text },
  spacer: { flexGrow: 1, minHeight: Spacing.xl },
  footer: { alignItems: 'center', gap: Spacing.xs },
  localNote: { ...Type.caption, textAlign: 'center' },
});
