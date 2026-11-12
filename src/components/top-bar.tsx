import type { Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FigmaIcon } from '@/components/icons/figma-icon';
import { Wordmark } from '@/components/wordmark';
import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import { useLayoutRtl, useT } from '@/i18n';
import { goBack } from '@/lib/navigation';

/** White bar at the top of a screen: back link (when `back`) or the VenU wordmark. */
export function TopBar({ back, backLabel, fallback = '/', right }: {
  back?: boolean;
  backLabel?: string;
  /** Where Back goes when there's no history (web reload, deep link). */
  fallback?: Href;
  right?: React.ReactNode;
}) {
  const t = useT('common');
  const label = backLabel ?? t('actions.back');
  return (
    <View style={styles.bar}>
      {back ? (
        <Pressable onPress={() => goBack(fallback)} hitSlop={10} style={styles.target} accessibilityRole="button" accessibilityLabel={label}>
          {/* ‹ is a mirrored character: an RTL paragraph draws it as › on its own. */}
          <Text style={styles.back}>‹ {label}</Text>
        </Pressable>
      ) : (
        <Wordmark />
      )}
      {right}
    </View>
  );
}

/**
 * Borderless back arrow for screens styled after the Figma setup frames (no bar), e.g. "← Profile".
 * Without `label` it shows only the arrow and reads as "Back".
 */
export function BackLink({ label, fallback = '/' }: { label?: string; fallback?: Href }) {
  const t = useT('common');
  const rtl = useLayoutRtl();
  return (
    <View style={styles.backRow}>
      <Pressable
        onPress={() => goBack(fallback)}
        style={styles.backLink}
        accessibilityRole="button"
        accessibilityLabel={label ? t('nav.backTo', { label }) : t('actions.back')}>
        {/* Points the way back: right in a mirrored (RTL) layout. */}
        <View style={rtl && styles.flip}>
          <FigmaIcon name="arrow-left" size={24} color={Colors.ink} />
        </View>
        {label ? <Text style={styles.backLinkLabel}>{label}</Text> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: Spacing.gutter,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  // Real padding, not just hitSlop: hitSlop doesn't enlarge the target on web.
  target: { minHeight: 44, justifyContent: 'center', paddingEnd: Spacing.md },
  back: { ...Type.bodyStrong, color: Colors.primary },
  backRow: { flexDirection: 'row', paddingHorizontal: Spacing.md, paddingTop: Spacing.xs },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 44, minWidth: 44, paddingHorizontal: Spacing.sm },
  backLinkLabel: { fontFamily: Fonts.display, fontSize: 16, lineHeight: 22, color: Colors.text },
  flip: { transform: [{ scaleX: -1 }] },
});
