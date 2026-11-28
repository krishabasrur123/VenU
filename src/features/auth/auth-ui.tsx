// Pieces shared by the landing, Sign In and Create Account screens (Figma "onboarding" frames).

import { router, type Href } from 'expo-router';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { FigmaIcon } from '@/components/icons/figma-icon';
import { FIGMA_ICONS } from '@/components/icons/figma-icons';
import { LanguagePill } from '@/components/language-pill';
import { LanguageSearchModal } from '@/components/language-picker';
import { TextField } from '@/components/text-field';
import { Colors, Face, Fonts, Spacing, Type } from '@/constants/theme';
import { languageName } from '@/features/profile/options';
import { UNTRANSLATED, useT, useUiLanguage } from '@/i18n';
import { choosePendingLanguage } from '@/i18n/pending-language';

import { providerName, type OAuthProvider } from './auth-redirect';

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
          // react-native-web reads only aria-* for state.
          aria-checked={checked}
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

const SOCIAL: { provider: OAuthProvider; x: number }[] = [
  { provider: 'facebook', x: 0 },
  { provider: 'google', x: 75 },
  { provider: 'apple', x: 150 },
];

/**
 * Figma "Frame 2105": the three logos come out of Figma as one 200x50 SVG; each button shows its 50x50 slice.
 * `busy`: that provider's sign-in is starting (a spinner over its logo; the row ignores taps meanwhile).
 */
export function SocialButtons({ onPress, busy = null }: { onPress: (provider: OAuthProvider) => void; busy?: OAuthProvider | null }) {
  const t = useT('onboarding');
  const xml = FIGMA_ICONS['group-35-265b5a'];
  return (
    <View style={styles.socialRow}>
      {SOCIAL.map(s => (
        <Pressable
          key={s.provider}
          onPress={() => onPress(s.provider)}
          disabled={busy !== null}
          style={({ pressed }) => [styles.social, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityState={{ busy: busy === s.provider, disabled: busy !== null }}
          accessibilityLabel={t('auth.signUpWith', { provider: providerName(s.provider) })}>
          <SvgXml xml={xml.replace('width="200"', 'width="50"').replace('viewBox="0 0 200 50"', `viewBox="${s.x} 0 50 50"`)} width={56} height={56} />
          {busy === s.provider && (
            <View style={styles.socialBusy}>
              <ActivityIndicator color={Colors.onPrimary} />
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}

/**
 * The pill plus its language list, for signed-out screens: a pick switches the app now; signing in
 * saves it to the account, and setup starts with it as the primary language.
 */
export function WelcomeLanguagePill() {
  const t = useT('onboarding');
  // The language on screen (an earlier pick, the last account's, or the device's).
  const { language } = useUiLanguage();
  const [open, setOpen] = useState(false);
  return (
    <>
      <LanguagePill
        label={languageName(language)}
        onPress={() => setOpen(true)}
        accessibilityLabel={t('auth.languagePill', { language: languageName(language) })}
        accessibilityHint={t('auth.languagePillHint')}
      />
      <LanguageSearchModal
        visible={open}
        title={t('welcome.languageTitle')}
        exclude={UNTRANSLATED}
        appLanguage
        selected={language}
        onSelect={code => {
          setOpen(false);
          choosePendingLanguage(code);
        }}
        onClose={() => setOpen(false)}
      />
    </>
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
  tick: { color: Colors.onPrimary, ...Face.textBold, fontSize: 15, lineHeight: 18 },
  checkLabel: { flex: 1 },
  error: { ...Type.caption, color: Colors.danger },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', columnGap: 6 },
  footerText: { ...Type.body },
  linkTarget: { minHeight: 44, justifyContent: 'center' },
  link: { ...Type.body, color: Colors.primary, textDecorationLine: 'underline' },

  socialRow: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  social: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden' },
  socialBusy: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  pressed: { opacity: 0.7 },

});
