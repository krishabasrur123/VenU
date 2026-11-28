/**
 * "Your status": Free / Busy / Off as a radio group, with a line saying what the choice does. While
 * helping someone (`helping`: their name) the line says so instead: no new requests come in then,
 * whatever the stored status.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { FigmaIcon } from '@/components/icons/figma-icon';
import { useWidestWord } from '@/components/widest-word';
import { Colors, Face, Fonts, Radius, Shadow, Spacing, Type } from '@/constants/theme';
import { AVAILABILITIES, type Availability } from '@/features/volunteer/availability';
import { useT } from '@/i18n';

// Same weight as the Figma clock (2pt strokes on a 20pt grid).
const STROKE = { strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;

/** Bell (Free: requests ring), clock (Busy), minus-circle (Off). */
function StatusIcon({ status, color, size = 26 }: { status: Availability; color: string; size?: number }) {
  if (status === 'busy') return <FigmaIcon name="clock" size={size} color={color} />;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {status === 'free' ? (
        <>
          <Path d="M18 8.5a6 6 0 0 0-12 0c0 6.5-2.5 8.5-2.5 8.5h17S18 15 18 8.5z" stroke={color} {...STROKE} />
          <Path d="M13.7 20.5a2 2 0 0 1-3.4 0" stroke={color} {...STROKE} />
        </>
      ) : (
        <>
          <Circle cx="12" cy="12" r="10" stroke={color} {...STROKE} />
          <Path d="M8 12h8" stroke={color} {...STROKE} />
        </>
      )}
    </Svg>
  );
}

/** The tick on the chosen tile, so the choice reads without colour. */
function Tick() {
  return (
    <View style={styles.tick}>
      <Svg width={12} height={12} viewBox="0 0 12 12" aria-hidden>
        <Path d="M2.5 6.2l2.3 2.3 4.7-5" stroke={Colors.onPrimary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    </View>
  );
}

const LABEL_SIZE = 15;
const MIN_SIZE = 11;
const BORDER = 2;

/**
 * Keeps the widest status word on one line in a third of the row: first the usual 15pt with 12pt
 * padding, then tighter 8pt padding with the text shrunk to fit (not below 11pt).
 * e.g. statusLabelFit(311, 60) → { size: 15, padding: 12 }
 *      statusLabelFit(248, 72) → { size: 11, padding: 8 } ("Զբաղված" on a 320pt phone)
 */
export function statusLabelFit(rowWidth: number, widestWord: number | null): { size: number; padding: number } {
  const roomy = { size: LABEL_SIZE, padding: Spacing.md };
  if (!rowWidth || widestWord === null) return roomy;
  const tile = (rowWidth - 2 * Spacing.md) / 3;
  const textWidth = (padding: number) => tile - 2 * (padding + BORDER);
  if (widestWord <= textWidth(Spacing.md)) return roomy;
  const padding = Spacing.sm;
  return { size: Math.max(MIN_SIZE, Math.min(LABEL_SIZE, Math.floor((LABEL_SIZE * textWidth(padding)) / widestWord))), padding };
}

export function StatusCard({ status, onChange, helping }: { status: Availability; onChange: (next: Availability) => void; helping?: string | null }) {
  const t = useT('volunteer');
  const [rowWidth, setRowWidth] = useState(0);
  // Measured in the chosen tile's (wider) weight, so choosing one never splits its word.
  const labels = useWidestWord(AVAILABILITIES.map(value => t(`home.status.${value}`)), styles.labelMeasure);
  const { size, padding } = statusLabelFit(rowWidth, labels.widest);
  const fit = size === LABEL_SIZE ? null : { fontSize: size, lineHeight: Math.round(size * 1.27) };
  const tight = padding === Spacing.md ? null : { padding };
  return (
    <View style={styles.card}>
      <Text style={styles.title} accessibilityRole="header">{t('home.statusTitle')}</Text>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={t('home.statusTitle')} onLayout={e => setRowWidth(e.nativeEvent.layout.width)}>
        {labels.probe}
        {AVAILABILITIES.map(value => {
          const selected = value === status;
          const color = selected ? Colors.primary : Colors.ink;
          return (
            <Pressable
              key={value}
              onPress={() => onChange(value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, selected }}
              // react-native-web reads only aria-* for state.
              aria-checked={selected}
              accessibilityLabel={t(`home.status.${value}`)}
              style={({ pressed }) => [styles.tile, tight, selected && styles.selected, pressed && styles.pressed]}>
              <View style={styles.tileTop}>
                <StatusIcon status={value} color={color} />
                {selected ? <Tick /> : null}
              </View>
              <Text style={[styles.label, selected && styles.labelSelected, fit]} numberOfLines={2}>{t(`home.status.${value}`)}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.line} accessibilityLiveRegion="polite">
        {helping != null ? t('home.statusLine.helping', { name: helping }) : t(`home.statusLine.${status}`)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt },
  title: { ...Type.bodyStrong },
  row: { flexDirection: 'row', gap: Spacing.md },
  tile: {
    flex: 1,
    minHeight: 76,
    padding: Spacing.md,
    gap: 6,
    borderRadius: Radius.md,
    // Always 2pt so choosing a tile doesn't shift its content.
    borderWidth: BORDER,
    borderColor: Colors.surface,
    backgroundColor: Colors.surface,
    ...Shadow.card,
  },
  selected: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  pressed: { opacity: 0.8 },
  label: { fontFamily: Fonts.display, fontSize: 15, lineHeight: 19, color: Colors.text },
  labelSelected: { ...Face.displayMedium, color: Colors.primary },
  labelMeasure: { ...Face.displayMedium, fontSize: LABEL_SIZE, lineHeight: 19 },
  // A row, not absolute: react-native-web ignores `end`, and a row flips in RTL on its own.
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  tick: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: { ...Type.caption, color: Colors.text },
});
