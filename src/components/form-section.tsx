import type { ReactNode } from 'react';
import { Trans } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import { useT } from '@/i18n';

interface FormSectionProps {
  title: string;
  /** Short helper line under the title. */
  hint?: string;
  optional?: boolean;
  error?: string;
  children: ReactNode;
}

/** A titled block in a form, with an optional hint and an error line. */
export function FormSection({ title, hint, optional, error, children }: FormSectionProps) {
  const t = useT('common');
  return (
    <View style={styles.section}>
      <Text style={styles.title} accessibilityRole="header">
        {/* One string, so a language can put "(optional)" where it belongs: "{{title}} <muted>(optional)</muted>". */}
        {optional ? (
          <Trans t={t} i18nKey="form.optionalTitle" values={{ title }} components={{ muted: <Text style={styles.optional} /> }} />
        ) : (
          title
        )}
      </Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
      <View style={styles.body}>{children}</View>
      {error && (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
    </View>
  );
}

/** Optional "STEP 1 OF 2" overline + title + subtitle, as in the Figma "Set up your profile" header. */
export function StepHeader({ step, total, title, subtitle }: { step?: number; total?: number; title: string; subtitle?: string }) {
  const t = useT('common');
  return (
    <View style={styles.header}>
      {step != null && total != null && <Text style={styles.step}>{t('form.step', { step, total })}</Text>}
      <Text style={styles.headerTitle} accessibilityRole="header">
        {title}
      </Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  // Figma: Alexandria 13 section titles with wide gaps between sections; 16 here (see theme.ts).
  section: { gap: Spacing.xs, marginBottom: Spacing.xxl },
  title: { fontFamily: Fonts.display, fontSize: 16, lineHeight: 22, color: Colors.text },
  optional: { fontFamily: Fonts.text, fontSize: 14, color: Colors.textMuted },
  hint: Type.caption,
  body: { marginTop: Spacing.md },
  error: { ...Type.caption, color: Colors.danger, marginTop: Spacing.xs },

  header: { gap: Spacing.sm, marginBottom: Spacing.xxl },
  step: { ...Type.overline, color: Colors.accent },
  headerTitle: { fontFamily: Fonts.display, fontSize: 28, lineHeight: 34, color: Colors.text },
  subtitle: { fontFamily: Fonts.text, fontSize: 14, lineHeight: 19, color: Colors.text },
});
