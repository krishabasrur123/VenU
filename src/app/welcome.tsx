import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { LanguageSearchModal } from '@/components/language-picker';
import { LogoMark } from '@/components/wordmark';
import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import { LanguagePill, SocialButtons } from '@/features/auth/auth-ui';
import { readPendingSetup } from '@/features/auth/pending-setup';
import { useSignedInHref } from '@/features/auth/use-auth-form';
import { languageName } from '@/features/profile/options';
import { useT } from '@/i18n';
import { choosePendingLanguage } from '@/i18n/pending-language';

/** Landing page for signed-out users (Figma onboarding__landing). */
export default function WelcomeScreen() {
  const signedInHref = useSignedInHref();
  const t = useT('onboarding');
  const [language, setLanguage] = useState('en');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [socialNote, setSocialNote] = useState(false);
  // Set once the user picks a language, so the slower read below can't overwrite their choice.
  const picked = useRef(false);

  // The language picked here on an earlier visit.
  useEffect(() => {
    let live = true;
    readPendingSetup().then(p => {
      if (live && !picked.current && p.language) setLanguage(p.language);
    });
    return () => { live = false; };
  }, []);

  // Opening /welcome while signed in (a bookmark, another tab): move on.
  if (signedInHref) return <Redirect href={signedInHref} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <LanguagePill label={languageName(language)} onPress={() => setPickerOpen(true)} />
        </View>

        <View style={styles.hero}>
          <LogoMark size={120} />
          <Text style={styles.name} accessibilityRole="header">VenU</Text>
        </View>

        <View style={styles.actions}>
          <Button label={t('welcome.createAccount')} variant="secondary" onPress={() => router.push('/sign-up')} style={styles.action} />
          <Text style={styles.or}>{t('welcome.or')}</Text>
          <Button label={t('welcome.signIn')} variant="dark" onPress={() => router.push('/sign-in')} style={styles.action} />
        </View>

        <View style={styles.social}>
          <Text style={styles.socialTitle}>{t('welcome.socialTitle')}</Text>
          <SocialButtons onPress={() => setSocialNote(true)} />
          {socialNote && (
            <Text style={styles.note} accessibilityLiveRegion="polite">
              {t('welcome.socialSoon')}
            </Text>
          )}
        </View>
      </ScrollView>

      <LanguageSearchModal
        visible={pickerOpen}
        title={t('welcome.languageTitle')}
        onSelect={code => {
          picked.current = true;
          setLanguage(code);
          setPickerOpen(false);
          // Switches the app to this language now; profile setup also starts with it as the primary language.
          choosePendingLanguage(code);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  content: { flexGrow: 1, paddingHorizontal: Spacing.gutter, paddingBottom: Spacing.xxl },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: Spacing.md },
  hero: { alignItems: 'center', marginTop: 56, gap: Spacing.gutter },
  name: { fontFamily: Fonts.display, fontSize: 28, lineHeight: 34, color: Colors.text },
  actions: { alignItems: 'center', marginTop: 64, gap: Spacing.lg },
  action: { width: 240 },
  or: { ...Type.body },
  social: { alignItems: 'center', marginTop: 56, gap: Spacing.lg },
  socialTitle: { ...Type.body, color: Colors.textFaint },
  note: { ...Type.caption, textAlign: 'center' },
});
