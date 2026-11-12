/**
 * The "Add picture" and "Or hold to speak" buttons under a note (Figma 2225 195:24894 and
 * 2224 168:17065; Variant2 is the pressed look). Used by the volunteer request note and the venue
 * report form. Each button shows only when its handler is set.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FigmaIcon } from '@/components/icons/figma-icon';
import { Colors, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { useT } from '@/i18n';

interface MediaActionsProps {
  onAddPicture?: () => void;
  /** Shows "Change picture" once one is attached. */
  hasPicture?: boolean;
  onSpeak?: () => void;
}

export function MediaActions({ onAddPicture, hasPicture = false, onSpeak }: MediaActionsProps) {
  const t = useT('common');
  if (!onAddPicture && !onSpeak) return null;
  const pictureLabel = hasPicture ? t('media.changePicture') : t('media.addPicture');
  return (
    <View style={styles.row}>
      {onAddPicture ? (
        <Pressable
          onPress={onAddPicture}
          accessibilityRole="button"
          accessibilityLabel={pictureLabel}
          style={({ pressed }) => [styles.action, styles.picture, pressed && styles.picturePressed]}>
          <FigmaIcon name="add-circle" size={22} color={Colors.ink} />
          <Text style={styles.text}>{pictureLabel}</Text>
        </Pressable>
      ) : null}
      {onSpeak ? (
        <Pressable
          onPress={onSpeak}
          accessibilityRole="button"
          accessibilityLabel={t('media.holdToSpeak')}
          style={({ pressed }) => [styles.action, styles.speak, pressed && styles.speakPressed]}>
          <FigmaIcon name="icon-c230e9" size={14} color={Colors.primary} />
          <Text style={[styles.text, styles.speakText]}>{t('media.holdToSpeak')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.md },
  action: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
  },
  picture: { flex: 1, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.controlBorder },
  picturePressed: Shadow.pressed,
  speak: { flex: 1.25, backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.primary },
  speakPressed: { backgroundColor: Colors.primarySoft },
  text: { fontFamily: Fonts.display, fontSize: 14, lineHeight: 18, color: Colors.ink },
  speakText: { color: Colors.primary },
});
