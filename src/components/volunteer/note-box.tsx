/**
 * Figma "Frame 2241" (235:26768): "Add a note (optional)", the multiline box, and (with
 * `onAddPicture` / `onSpeak`) the "Add picture" and speak buttons under it; `listening` shows dictation on.
 * `hideLabel` drops the label when a NoteToggle row above already names the box (Find a Volunteer v3).
 * Near the limit a counter shows under the box ("450 of 500 characters").
 */
import { Image } from 'expo-image';
import { Trans } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MediaActions } from '@/components/media-actions';
import { TextField } from '@/components/text-field';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { languageOf, useT } from '@/i18n';
import { formatNumber } from '@/i18n/format';

/** Longest note; the counter shows from NOTE_COUNTER_FROM characters. */
export const NOTE_MAX = 500;
const NOTE_COUNTER_FROM = 400;

interface NoteBoxProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  photoUri?: string | null;
  onAddPicture?: () => void;
  onRemovePicture?: () => void;
  onSpeak?: () => void;
  speakLabel?: string;
  listening?: boolean;
  hideLabel?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
}

export function NoteBox({ value, onChangeText, placeholder, photoUri, onAddPicture, onRemovePicture, onSpeak, speakLabel, listening, hideLabel, autoFocus, maxLength = NOTE_MAX }: NoteBoxProps) {
  const t = useT('volunteer');
  const lng = languageOf(t);
  const near = value.length >= maxLength - (NOTE_MAX - NOTE_COUNTER_FROM);
  const count = near ? t('note.count', { used: formatNumber(Math.min(value.length, maxLength), undefined, lng), max: formatNumber(maxLength, undefined, lng) }) : undefined;
  return (
    <View style={styles.wrap}>
      <View style={styles.field}>
        {/* One sentence for translators; the "(optional)" part is muted. */}
        {hideLabel ? null : (
          <Text style={styles.label}>
            <Trans t={t} i18nKey="note.label" components={{ muted: <Text style={styles.optional} /> }} />
          </Text>
        )}
        <TextField
          value={value}
          onChangeText={text => onChangeText(text.slice(0, maxLength))}
          placeholder={placeholder ?? t('note.placeholder')}
          multiline
          maxLength={maxLength}
          hint={count}
          autoFocus={autoFocus}
          accessibilityLabel={t('note.labelPlain')}
        />
      </View>

      {photoUri ? (
        <View style={styles.photoRow}>
          <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" accessibilityLabel={t('note.attached')} />
          <Pressable onPress={onRemovePicture} style={styles.remove} accessibilityRole="button" accessibilityLabel={t('note.remove')}>
            <Text style={styles.removeText}>{t('note.remove')}</Text>
          </Pressable>
        </View>
      ) : null}

      <MediaActions onAddPicture={onAddPicture} hasPicture={!!photoUri} onSpeak={onSpeak} speakLabel={speakLabel} listening={listening} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.lg },
  field: { gap: 7 },
  label: { ...Type.body },
  optional: { color: Colors.textFaint },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  photo: { width: 64, height: 64, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt },
  remove: { minHeight: 44, justifyContent: 'center' },
  removeText: { ...Type.body, color: Colors.danger, textDecorationLine: 'underline' },
});
