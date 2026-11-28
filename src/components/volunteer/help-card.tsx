/**
 * A help type on Find a Volunteer v3 (Figma 506:9816): a full-width white row with a radio circle,
 * the type's icon and its label. One type per request, so the rows are radios in a radiogroup;
 * chosen, the row turns blue-tinted with a filled dot. Long labels (Armenian, Russian) wrap
 * inside the row instead of splitting words, so no fit check is needed.
 * e.g. <HelpRow type="directions" selected={chosen === 'directions'} onPress={() => choose('directions')} />
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Shadow, Spacing, Type } from '@/constants/theme';
import { HELP_TYPES } from '@/features/volunteer/mock';
import type { HelpTypeId } from '@/features/volunteer/types';
import { useT } from '@/i18n';

import { HelpIcon } from './help-icon';

/**
 * The one help type a request asks for: the first of `selected` in screen order, or null.
 * The draft keeps `helpTypes` as a list (the database column is an array); drafts saved before
 * the list became single-choice can hold several, and this picks the one the form shows.
 * e.g. chosenHelpType(['language', 'physical']) → 'physical'; chosenHelpType([]) → null
 */
export function chosenHelpType(selected: readonly HelpTypeId[]): HelpTypeId | null {
  return HELP_TYPES.find(id => selected.includes(id)) ?? null;
}

export function HelpRow({ type, selected, onPress }: { type: HelpTypeId; selected: boolean; onPress: () => void }) {
  const t = useT('volunteer');
  const label = t(`helpTypes.${type}`);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      // react-native-web reads only aria-* for state.
      aria-checked={selected}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, selected && styles.selected, pressed && !selected && styles.pressed]}>
      <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <View style={styles.dot} /> : null}</View>
      <HelpIcon type={type} size={26} color={selected ? Colors.primary : Colors.ink} />
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Figma: 44 tall, radius 10, 1px gray outline, the card shadow.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    minHeight: 48,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.controlBorder,
    backgroundColor: Colors.surface,
    ...Shadow.card,
  },
  selected: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  pressed: { backgroundColor: Colors.surfaceAlt },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: Colors.controlBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: Spacing.xs,
  },
  radioOn: { borderColor: Colors.primary, borderWidth: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  label: { ...Type.body, fontSize: 16, lineHeight: 21, flex: 1 },
  labelSelected: { color: Colors.primary },
});
