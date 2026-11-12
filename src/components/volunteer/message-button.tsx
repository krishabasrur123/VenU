/** Figma "Message 1" (235:26730): the chat icon, with a red dot when there's an unread message. */
import { Pressable, StyleSheet, View } from 'react-native';

import { FigmaIcon } from '@/components/icons/figma-icon';
import { Colors } from '@/constants/theme';
import { useT } from '@/i18n';

export function MessageButton({ unread, onPress }: { unread: number; onPress: () => void }) {
  const t = useT('volunteer');
  const label = unread ? t('messages.unread', { count: unread }) : t('messages.label');
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.target, pressed && styles.pressed]}>
      <FigmaIcon name="message-1-6cfb1c" size={30} color={Colors.ink} />
      {unread ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginEnd: -9 },
  pressed: { opacity: 0.6 },
  dot: {
    position: 'absolute',
    top: 6,
    end: 4,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: Colors.danger,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
});
