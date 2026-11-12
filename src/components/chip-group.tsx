import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/chip';
import { Spacing } from '@/constants/theme';
import type { Option } from '@/features/profile/options';

type SingleProps<T extends string> = {
  multiple?: false;
  value: T | null;
  onChange: (value: T) => void;
};

type MultiProps<T extends string> = {
  multiple: true;
  value: T[];
  onChange: (value: T[]) => void;
};

type ChipGroupProps<T extends string> = {
  options: Option<T>[];
  accessibilityLabel?: string;
  /** Lay the chips out in a grid of this many equal columns instead of a wrapping row. */
  columns?: number;
} & (SingleProps<T> | MultiProps<T>);

/** A wrapping row of chips. Single-select acts like radios, `multiple` like checkboxes. */
export function ChipGroup<T extends string>(props: ChipGroupProps<T>) {
  const { options, accessibilityLabel, columns } = props;

  function isSelected(v: T) {
    return props.multiple ? props.value.includes(v) : props.value === v;
  }

  function toggle(v: T) {
    if (props.multiple) {
      props.onChange(props.value.includes(v) ? props.value.filter(x => x !== v) : [...props.value, v]);
    } else {
      props.onChange(v);
    }
  }

  const chip = (o: Option<T>) => (
    <Chip
      key={o.value}
      label={o.label}
      selected={isSelected(o.value)}
      role={props.multiple ? 'checkbox' : 'radio'}
      onPress={() => toggle(o.value)}
      fill={!!columns}
    />
  );
  const role = props.multiple ? undefined : 'radiogroup';

  if (columns) {
    const rows: Option<T>[][] = [];
    for (let i = 0; i < options.length; i += columns) rows.push(options.slice(i, i + columns));
    return (
      <View style={styles.grid} accessibilityRole={role} accessibilityLabel={accessibilityLabel}>
        {rows.map((row, r) => (
          <View key={r} style={styles.gridRow}>
            {row.map(chip)}
            {/* Keep the last row's chips the same width as the rows above. */}
            {Array.from({ length: columns - row.length }, (_, i) => <View key={`pad${i}`} style={styles.pad} />)}
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.row} accessibilityRole={role} accessibilityLabel={accessibilityLabel}>
      {options.map(chip)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  grid: { gap: Spacing.sm },
  gridRow: { flexDirection: 'row', gap: Spacing.sm },
  pad: { flex: 1 },
});
