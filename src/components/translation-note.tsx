/**
 * The line under translated text (a chat message, a visitor's request note, a facility report):
 * "Translated from Spanish · Show original" (a button that flips between the two), or why the
 * original is showing ("Translating…", "Couldn't translate · Try again", "Translation isn't set up yet").
 *
 *   const { text, view, original, toggle, retry } = useTranslatedText({ id: 'note:req-1', from: 'them', text: note }, reader);
 *   <Text>{text}</Text>
 *   <TranslationNote translation={view} reader={reader} original={original} onToggle={toggle} onRetry={retry} />
 */
import { Pressable, StyleSheet, Text } from 'react-native';

import { Colors, Face, Fonts } from '@/constants/theme';
import { uiLanguageName } from '@/features/profile/summary';
import type { MessageTranslation } from '@/features/translate';
import { useT } from '@/i18n';

interface Props {
  translation: MessageTranslation;
  reader: string;
  original: boolean;
  onToggle: () => void;
  onRetry: () => void;
  /** Hide "Translation isn't set up yet" (e.g. a report, which reads fine as written). */
  quietWhenUnavailable?: boolean;
}

export function TranslationNote({ translation, reader, original, onToggle, onRetry, quietWhenUnavailable }: Props) {
  const t = useT('volunteer');
  const tp = useT('profile'); // language names in the UI language
  switch (translation.kind) {
    case 'original':
      return null;
    case 'loading':
      return <Text style={styles.note}>{t('translation.translating')}</Text>;
    case 'failed':
      return (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={t('translation.tryAgainLabel')}
          hitSlop={6}
          style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}>
          <Text style={styles.note}>
            {t('translation.failed')}
            {' · '}
            <Text style={styles.noteLink}>{t('translation.tryAgain')}</Text>
          </Text>
        </Pressable>
      );
    case 'unsupported':
      return quietWhenUnavailable ? null : <Text style={styles.note}>{t('translation.unsupported', { language: uiLanguageName(reader, tp) })}</Text>;
    case 'unavailable':
      return quietWhenUnavailable ? null : <Text style={styles.note}>{t('translation.notSetUp')}</Text>;
    case 'translated': {
      const language = translation.source ? uiLanguageName(translation.source, tp) : null;
      const translatedNote = language
        ? translation.partial ? t('translation.partial', { language }) : t('translation.translatedFrom', { language })
        : t('translation.translated');
      const status = original
        ? language ? t('translation.originalIn', { language }) : t('translation.original')
        : translatedNote;
      return (
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityLabel={original ? t('translation.showTranslationLabel') : t('translation.showOriginalLabel')}
          hitSlop={6}
          style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}>
          <Text style={styles.note}>
            {status}
            {' · '}
            <Text style={styles.noteLink}>{original ? t('translation.showTranslation') : t('translation.showOriginal')}</Text>
          </Text>
        </Pressable>
      );
    }
  }
}

const styles = StyleSheet.create({
  toggle: { minHeight: 32, justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  note: { fontFamily: Fonts.text, fontSize: 13, lineHeight: 16, color: Colors.textMuted },
  noteLink: { ...Face.textSemiBold, color: Colors.primary },
});
