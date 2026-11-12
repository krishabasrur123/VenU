/**
 * Figma "Frame 2241" (235:26768): "Add a note (optional)", the multiline box, and (with
 * `onAddPicture` / `onSpeak`) the "Add picture" and "Or hold to speak" buttons under it.
 */
import { Image } from 'expo-image';
import { Trans } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MediaActions } from '@/components/media-actions';
import { TextField } from '@/components/text-field';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { useT } from '@/i18n';

interface NoteBoxProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  photoUri?: string | null;
  onAddPicture?: () => void;
  onRemovePicture?: () => void;
  onSpeak?: () => void;
}

export function NoteBox({ value, onChangeText, placeholder, photoUri, onAddPicture, onRemovePicture, onSpeak }: NoteBoxProps) {
  const t = useT('volunteer');
  return (
    <View style={styles.wrap}>
      <View style={styles.field}>
        {/* One sentence for translators; the "(optional)" part is muted. */}
        <Text style={styles.label}>
          <Trans t={t} i18nKey="note.label" components={{ muted: <Text style={styles.optional} /> }} />
        </Text>
        <TextField
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ?? t('note.placeholder')}
          multiline
          maxLength={500}
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

      <MediaActions onAddPicture={onAddPicture} hasPicture={!!photoUri} onSpeak={onSpeak} />
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
