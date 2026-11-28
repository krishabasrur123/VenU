/**
 * A visitor's request note in the reader's language, with "Translated from Spanish · Show original"
 * under it, like a chat message. The same translation (one call, kept across reloads) is shared by the
 * volunteer's request card, their helping card and the chat, under the id `note:<request id>`.
 * The visitor's own note (`mine`) shows as written, and so does one already in the reader's language
 * (`lang`: the language the visitor asked for help in, taken as the note's), without a translator call.
 *
 * RequestSummary: the request at the top of the chat ("Lucia's request · Language Help" and the note).
 */
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

import { TranslationNote } from '@/components/translation-note';
import { Colors, Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { useReaderLanguage, useTranslatedText } from '@/features/translate';
import type { HelpTypeId } from '@/features/volunteer/types';
import { useT } from '@/i18n';

import { HelpIcon } from './help-icon';

interface NoteProps {
  requestId: string;
  note: string;
  /** The request's language, e.g. 'es' (the note is taken to be written in it). */
  lang?: string;
  /** The reader wrote it (the visitor): no translation. */
  mine?: boolean;
  style?: StyleProp<TextStyle>;
}

export function RequestNote({ requestId, note, lang, mine = false, style }: NoteProps) {
  const t = useT('volunteer');
  const reader = useReaderLanguage();
  const { text, view, original, toggle, retry } = useTranslatedText(
    { id: `note:${requestId}`, from: mine ? 'me' : 'them', text: note, ...(lang ? { lang } : {}) },
    reader,
  );
  return (
    <View>
      <Text style={style}>{t('quoted', { text })}</Text>
      {/* A note reads fine as written: no "isn't set up" line where translation is off. */}
      <TranslationNote translation={view} reader={reader} original={original} onToggle={toggle} onRetry={retry} quietWhenUnavailable />
    </View>
  );
}

interface SummaryProps {
  request: { id: string; helpTypes: HelpTypeId[]; note: string; language: string; mine: boolean };
  /** The visitor's first name, on the volunteer's side. */
  visitorName: string;
}

export function RequestSummary({ request, visitorName }: SummaryProps) {
  const t = useT('volunteer');
  const help = request.helpTypes.map(h => t(`helpTypes.${h}`)).join(' · ');
  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.iconTile}>
        <HelpIcon type={request.helpTypes[0] ?? 'other'} size={22} color={Colors.primary} />
      </View>
      <View style={styles.text}>
        <Text style={styles.label}>{request.mine ? t('chat.yourRequest') : t('chat.requestFrom', { name: visitorName })}</Text>
        <Text style={Type.bodyStrong}>{help}</Text>
        {request.note ? <RequestNote requestId={request.id} note={request.note} lang={request.language} mine={request.mine} style={styles.note} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  iconTile: { width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  label: { fontFamily: Fonts.text, fontSize: 13, lineHeight: 16, color: Colors.textMuted },
  note: { ...Type.caption, color: Colors.text, marginTop: 2 },
});
