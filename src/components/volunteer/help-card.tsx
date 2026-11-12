/** Figma "Volunteer Cards" (152:16995): white tile with an icon and a two-line label; Selected is blue. */
import { Pressable, StyleSheet, Text } from 'react-native';

import { Colors, Fonts, Radius, Shadow } from '@/constants/theme';
import type { HelpTypeId } from '@/features/volunteer/types';
import { useT } from '@/i18n';

import { HelpIcon } from './help-icon';

export function HelpCard({ type, selected, onPress }: { type: HelpTypeId; selected: boolean; onPress: () => void }) {
  const t = useT('volunteer');
  const label = t(`helpTypes.${type}`);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.card, selected && styles.selected, pressed && styles.pressed]}>
      <HelpIcon type={type} />
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 90,
    padding: 10,
    gap: 4,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceAlt,
    backgroundColor: Colors.surface,
    ...Shadow.card,
  },
  selected: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  pressed: { opacity: 0.8 },
  label: { fontFamily: Fonts.display, fontSize: 14, lineHeight: 17, color: Colors.text },
  labelSelected: { color: Colors.primary },
});
