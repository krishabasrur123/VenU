/**
 * Pieces for the Onboarding 2.0 setup steps: a titled group in a frosted box (Figma 506:10114
 * "I'd prefer help from" / "Anything we should know?") and the "Gender [chips]" label row.
 */
import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Radius, Spacing, Type } from '@/constants/theme';

export function SetupGroup({ title, hint, error, children }: { title: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={[styles.box, error ? styles.boxError : null]}>{children}</View>
      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
    </View>
  );
}

/** Figma "Gender  [No preference] [Male] [Female]": a label at its own width, then the chips. */
export function LabeledRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.flex}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.sm, marginBottom: Spacing.xl },
  title: { ...Type.body, fontSize: 16, lineHeight: 21, paddingHorizontal: Spacing.sm },
  hint: { ...Type.caption, paddingHorizontal: Spacing.sm },
  // Figma's frosted glass card: a faint blue-gray tint and a white rim over the gradient, the
  // gradient blurred behind it where the platform can (web).
  box: {
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.frostBorder,
    backgroundColor: Colors.frost,
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(12px)' } as object) : null),
  },
  boxError: { borderColor: Colors.danger },
  error: { ...Type.caption, color: Colors.danger },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  rowLabel: { fontFamily: Fonts.display, fontSize: 15, lineHeight: 20, color: Colors.text, paddingTop: 8 },
  flex: { flex: 1 },
});
