import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StepHeader } from '@/components/form-section';
import { Colors, Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { PRIVACY_SECTIONS, PRIVACY_VERSION } from '@/features/profile/privacy';
import { useT, useUiLanguage } from '@/i18n';
import { goBack } from '@/lib/navigation';

/**
 * The privacy policy, from Profile → Privacy & data, profile setup's agreement and the terms page.
 * Headings are translated; the points stay English until a reviewed translation exists.
 */
export default function PrivacyScreen() {
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
        <StepHeader title={t('privacy.title')} subtitle={t('privacy.summary')} />
        {language !== 'en' && <Text style={styles.notice}>{t('privacy.englishNotice')}</Text>}

        {PRIVACY_SECTIONS.map(section => (
          <View key={section.key} style={styles.card}>
            <Text style={styles.cardTitle} accessibilityRole="header">{t(`privacy.sections.${section.key}`)}</Text>
            {section.points.map(point => (
              <View key={point} style={styles.point}>
                <View style={styles.bullet} />
                <Text style={styles.pointText}>{point}</Text>
              </View>
            ))}
          </View>
        ))}

        <Text style={styles.version}>{t('privacy.version', { version: PRIVACY_VERSION })}</Text>
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
  // Figma info tiles: #F5F5F5, radius 10, no outline.
  card: { gap: Spacing.sm, padding: Spacing.lg, marginBottom: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt },
  cardTitle: { fontFamily: Fonts.display, fontSize: 17, lineHeight: 22, color: Colors.text, marginBottom: 2 },
  point: { flexDirection: 'row', gap: Spacing.md },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.ink, marginTop: 8 },
  pointText: { fontFamily: Fonts.text, fontSize: 15, lineHeight: 21, color: Colors.text, flex: 1 },
  version: { ...Type.caption, textAlign: 'center', marginTop: Spacing.md },
});
