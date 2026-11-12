// Pieces shared by the landing, Sign In and Create Account screens (Figma "onboarding" frames).

import { router, type Href } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Line, SvgXml } from 'react-native-svg';

import { FigmaIcon } from '@/components/icons/figma-icon';
import { FIGMA_ICONS } from '@/components/icons/figma-icons';
import { TextField } from '@/components/text-field';
import { Colors, Fonts, Radius, Shadow, Spacing, Type } from '@/constants/theme';
import { useT } from '@/i18n';

/** Alexandria field label over the Figma "msft_TextInput" box. */
export function AuthField({ label, ...field }: { label: string } & ComponentProps<typeof TextField>) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextField accessibilityLabel={label} {...field} />
    </View>
  );
}

/** The Figma "check_box_outline_blank" box with a label; ticked, it fills ink with a white check. */
export function Checkbox({ checked, onToggle, error, children, accessibilityLabel }: {
  checked: boolean;
  onToggle: () => void;
  error?: string | null;
  children: ReactNode;
  accessibilityLabel: string;
}) {
  return (
    <View style={styles.checkWrap}>
      <View style={styles.checkRow}>
        <Pressable
          onPress={onToggle}
          style={styles.checkTarget}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          accessibilityLabel={accessibilityLabel}>
          {checked ? (
            <View style={[styles.box, error && styles.boxError]}>
              <Text style={styles.tick}>✓</Text>
            </View>
          ) : (
            <FigmaIcon name="checkbox-blank" size={30} color={error ? Colors.danger : Colors.ink} />
          )}
        </Pressable>
        <View style={styles.checkLabel}>{children}</View>
      </View>
      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
    </View>
  );
}

/**
 * "Already have an account?" then a "Sign In" link: a whole question plus a separate action, so each
 * translates on its own; the row mirrors in RTL (question on the right, link to its left).
 */
export function FooterPrompt({ text, action, href }: { text: string; action: string; href: Href }) {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>{text}</Text>
      <Pressable onPress={() => router.replace(href)} style={styles.linkTarget} accessibilityRole="link" accessibilityLabel={action}>
        <Text style={styles.link}>{action}</Text>
      </Pressable>
    </View>
  );
}

const SOCIAL = [
  { name: 'Facebook', x: 0 },
  { name: 'Google', x: 75 },
  { name: 'Apple', x: 150 },
] as const;

/** Figma "Frame 2105": the three logos come out of Figma as one 200x50 SVG; each button shows its 50x50 slice. */
export function SocialButtons({ onPress }: { onPress: (provider: string) => void }) {
  const t = useT('onboarding');
  const xml = FIGMA_ICONS['group-35-265b5a'];
  return (
    <View style={styles.socialRow}>
      {SOCIAL.map(s => (
        <Pressable
          key={s.name}
          onPress={() => onPress(s.name)}
          style={({ pressed }) => [styles.social, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('auth.signUpWith', { provider: s.name })}>
          <SvgXml xml={xml.replace('width="200"', 'width="50"').replace('viewBox="0 0 200 50"', `viewBox="${s.x} 0 50 50"`)} width={56} height={56} />
        </Pressable>
      ))}
    </View>
  );
}

/** Globe outline for the language pill (no globe in the Figma SVG export). */
function Globe({ size = 22, color = Colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9.5} stroke={color} strokeWidth={1.6} />
      <Ellipse cx={12} cy={12} rx={4.2} ry={9.5} stroke={color} strokeWidth={1.6} />
      <Line x1={2.5} y1={12} x2={21.5} y2={12} stroke={color} strokeWidth={1.6} />
      <Line x1={4} y1={7} x2={20} y2={7} stroke={color} strokeWidth={1.3} />
      <Line x1={4} y1={17} x2={20} y2={17} stroke={color} strokeWidth={1.3} />
    </Svg>
  );
}

/** Top-right "🌐 English" pill on the landing page. */
export function LanguagePill({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useT('onboarding');
  return (
    <Pressable
      onPress={onPress}
      style={styles.pillTarget}
      accessibilityRole="button"
      accessibilityLabel={t('auth.languagePill', { language: label })}
      accessibilityHint={t('auth.languagePillHint')}>
      {({ pressed }) => (
        <View style={[styles.pill, pressed && styles.pressed]}>
          <Globe />
          <Text style={styles.pillLabel}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  fieldLabel: { fontFamily: Fonts.display, fontSize: 15, lineHeight: 20, color: Colors.text },

  checkWrap: { gap: Spacing.xs },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  // 44pt target around the 24pt box (the box is drawn at 30 so its 18pt glyph reads at 24).
  checkTarget: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginStart: -7 },
  box: { width: 22, height: 22, borderRadius: 3, backgroundColor: Colors.ink, alignItems: 'center', justifyContent: 'center' },
  boxError: { backgroundColor: Colors.danger },
  tick: { color: Colors.onPrimary, fontFamily: Fonts.textBold, fontSize: 15, lineHeight: 18 },
  checkLabel: { flex: 1 },
  error: { ...Type.caption, color: Colors.danger },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', columnGap: 6 },
  footerText: { ...Type.body },
  linkTarget: { minHeight: 44, justifyContent: 'center' },
  link: { ...Type.body, color: Colors.primary, textDecorationLine: 'underline' },

  socialRow: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  social: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden' },
  pressed: { opacity: 0.7 },

  pillTarget: { minHeight: 44, justifyContent: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.controlBorder,
    backgroundColor: Colors.surface,
    ...Shadow.card,
    shadowOpacity: 0.12,
  },
  pillLabel: { ...Type.body, writingDirection: 'ltr' },
});
