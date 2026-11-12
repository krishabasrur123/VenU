import { router } from 'expo-router';
import { Trans } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StepHeader } from '@/components/form-section';
import { Colors, Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { useT, useUiLanguage } from '@/i18n';
import { goBack } from '@/lib/navigation';

// Plain-language terms for a student project. DRAFT, not legal text: the team reviews it before launch.
// Headings are translated (profile:terms.sections.<key>); the points stay English in every language
// until a reviewed translation exists.
const TERMS_VERSION = '2026-11-draft-1';

type TermsSectionKey = 'what' | 'emergencies' | 'kind' | 'remove' | 'guarantees';

const TERMS_SECTIONS: { key: TermsSectionKey; title: string; points: string[] }[] = [
  {
    key: 'what',
    title: 'What VenU is',
    points: [
      'A student project that connects LA28 visitors who need a hand with volunteers at the venue.',
      'It’s free, and still being tested, so some things may not work yet.',
    ],
  },
  {
    key: 'emergencies',
    title: 'Not for emergencies',
    points: [
      'In an emergency, call 911 or tell the nearest venue staff member.',
      'Volunteers can guide and translate, but they aren’t medical or security staff.',
    ],
  },
  {
    key: 'kind',
    title: 'Be kind and honest',
    points: [
      'Treat visitors and volunteers with respect, and only ask for help you need.',
      'Use your real first name, and only add a photo of yourself.',
      'Reports about facilities should describe what you actually saw.',
    ],
  },
  {
    key: 'remove',
    title: 'What we can remove',
    points: [
      'We can remove reports or accounts that are abusive, false or unsafe.',
      'You can delete your account and data any time from Profile.',
    ],
  },
  {
    key: 'guarantees',
    title: 'No guarantees',
    points: [
      'We can’t promise a volunteer will always be free, or that venue info is always up to date.',
      'Volunteers help in good faith; VenU isn’t responsible for what happens at the venue.',
    ],
  },
];

/** Terms of use, from Profile → Terms of use and Create Account's "Terms & Conditions" link. */
export default function TermsScreen() {
  const t = useT('profile');
  const tc = useT('common');
  const { language } = useUiLanguage();
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.bar}>
        <Pressable onPress={() => goBack('/')} style={styles.closeTarget} accessibilityRole="button">
          <Text style={styles.close}>{tc('actions.close')}</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <StepHeader title={t('terms.title')} subtitle={t('terms.subtitle')} />
        {language !== 'en' && <Text style={styles.notice}>{t('terms.englishNotice')}</Text>}

        {TERMS_SECTIONS.map(section => (
          <View key={section.key} style={styles.card}>
            <Text style={styles.cardTitle} accessibilityRole="header">{t(`terms.sections.${section.key}`)}</Text>
            {section.points.map(point => (
              <View key={point} style={styles.point}>
                <View style={styles.bullet} />
                <Text style={styles.pointText}>{point}</Text>
              </View>
            ))}
          </View>
        ))}

        <Text style={styles.privacy}>
          <Trans
            t={t}
            i18nKey="terms.privacyLink"
            components={{ a: <Text style={styles.link} onPress={() => router.push('/privacy')} accessibilityRole="link" /> }}
          />
        </Text>
        <Text style={styles.version}>{t('terms.version', { version: TERMS_VERSION })}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  bar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: Spacing.gutter, paddingTop: Spacing.xs },
  closeTarget: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' },
  close: { ...Type.body, color: Colors.primary, textDecorationLine: 'underline' },
  content: { paddingHorizontal: Spacing.gutter, paddingTop: Spacing.sm, paddingBottom: 48 },
  notice: { ...Type.caption, marginTop: -Spacing.lg, marginBottom: Spacing.lg },
  // Same info tiles as the privacy policy: #F5F5F5, radius 10, no outline.
  card: { gap: Spacing.sm, padding: Spacing.lg, marginBottom: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt },
  cardTitle: { fontFamily: Fonts.display, fontSize: 17, lineHeight: 22, color: Colors.text, marginBottom: 2 },
  point: { flexDirection: 'row', gap: Spacing.md },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.ink, marginTop: 8 },
  pointText: { fontFamily: Fonts.text, fontSize: 15, lineHeight: 21, color: Colors.text, flex: 1 },
  privacy: { ...Type.body, marginTop: Spacing.sm },
  link: { color: Colors.primary, textDecorationLine: 'underline' },
  version: { ...Type.caption, textAlign: 'center', marginTop: Spacing.lg },
});
