import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Button } from '@/components/button';
import { FormSection, StepHeader } from '@/components/form-section';
import { TextField } from '@/components/text-field';
import { BackLink } from '@/components/top-bar';
import { Colors, Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { useT } from '@/i18n';

/** Question and answer text: profile:help.faq.<key>.q / .a. */
const FAQ = ['matching', 'volunteers', 'emergency', 'languages', 'privacy', 'report'] as const;

const FEEDBACK_MAX = 1000;

/** Profile → Help & feedback: FAQ answers that expand, and a feedback box. */
export default function HelpScreen() {
  const t = useT('profile');
  const [open, setOpen] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function send() {
    const text = feedback.trim();
    if (!text) return setError(t('help.empty'));
    // Mock: nowhere to send it yet. A backend can replace this log.
    console.log('[feedback]', text);
    setError(null);
    setFeedback('');
    setSent(true);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <BackLink label={t('tab.title')} fallback="/profile" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <StepHeader title={t('help.title')} subtitle={t('help.subtitle')} />

          <FormSection title={t('help.commonQuestions')}>
            <View style={styles.card}>
              {FAQ.map((key, i) => {
                const expanded = open === i;
                return (
                  <View key={key}>
                    <Pressable
                      onPress={() => setOpen(expanded ? null : i)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded }}
                      aria-expanded={expanded}
                      style={({ pressed }) => [styles.q, pressed && styles.pressed]}>
                      <Text style={styles.qText}>{t(`help.faq.${key}.q`)}</Text>
                      <Chevron up={expanded} />
                    </Pressable>
                    {expanded && <Text style={styles.a}>{t(`help.faq.${key}.a`)}</Text>}
                    {i < FAQ.length - 1 && <View style={styles.divider} />}
                  </View>
                );
              })}
            </View>
          </FormSection>

          <FormSection title={t('help.sendFeedback')} hint={t('help.feedbackHint')}>
            {sent ? (
              <View style={styles.thanks} accessibilityLiveRegion="polite">
                <Text style={styles.thanksTitle}>{t('help.thanksTitle')}</Text>
                <Text style={Type.body}>{t('help.thanksBody')}</Text>
                <Button label={t('help.sendMore')} variant="link" onPress={() => setSent(false)} style={styles.more} />
              </View>
            ) : (
              <View style={styles.form}>
                <TextField
                  value={feedback}
                  onChangeText={v => {
                    setFeedback(v);
                    if (error) setError(null);
                  }}
                  placeholder={t('help.placeholder')}
                  multiline
                  maxLength={FEEDBACK_MAX}
                  accessibilityLabel={t('help.feedbackLabel')}
                  error={error}
                />
                <Button label={t('help.send')} onPress={send} />
              </View>
            )}
          </FormSection>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Chevron({ up }: { up: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" style={up ? styles.flip : undefined}>
      <Path d="M6 9l6 6 6-6" stroke={Colors.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  content: { paddingHorizontal: Spacing.gutter, paddingTop: Spacing.lg, paddingBottom: 48 },

  card: { borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.controlBorder, backgroundColor: Colors.surface, overflow: 'hidden' },
  q: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.md },
  pressed: { backgroundColor: Colors.surfaceAlt },
  qText: { fontFamily: Fonts.display, fontSize: 15, lineHeight: 20, color: Colors.text, flex: 1 },
  a: { fontFamily: Fonts.text, fontSize: 15, lineHeight: 21, color: Colors.textMuted, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  divider: { height: 1, backgroundColor: Colors.divider, marginStart: Spacing.lg },
  flip: { transform: [{ rotate: '180deg' }] },

  form: { gap: Spacing.md },
  thanks: { gap: Spacing.xs, padding: Spacing.lg, borderRadius: Radius.md, backgroundColor: Colors.successSoft },
  thanksTitle: { fontFamily: Fonts.displayMedium, fontSize: 17, lineHeight: 22, color: Colors.text },
  more: { alignSelf: 'flex-start' },
});
