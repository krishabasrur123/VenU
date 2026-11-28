/**
 * "Outside · Level 3 · Level 6": switches the venue map between its layers (VenueMap.layers). The
 * screen lays it over the map's top-left corner, under the source bar. With a chip on, `counts`
 * puts a badge on each button (how many of the chip's pins that layer has), and a screen reader
 * hears "Level 3, 3 matches" or "Outside, no matches" (layerCountLabel), not the bare "Level 3 3".
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Face, Radius, Shadow, Spacing } from '@/constants/theme';
import { languageOf, useT } from '@/i18n';
import { formatNumber } from '@/i18n/format';

import { layerCountLabel, layerLabel } from './labels';
import type { VenueMapLayer } from './venue-maps';

/** The toggle's height, under the map's source bar; map fits keep this much clear. */
export const LAYER_TOGGLE = 40;

export function LayerToggle({ layers, value, counts, onChange }: {
  layers: VenueMapLayer[];
  value: string;
  counts?: Record<string, number>;
  onChange: (id: string) => void;
}) {
  const t = useT('venue');
  const lang = languageOf(t);
  return (
    <View style={styles.layers} accessibilityRole="radiogroup" accessibilityLabel={t('map.layers.label')}>
      {layers.map(layer => {
        const on = layer.id === value;
        const count = counts?.[layer.id];
        return (
          <Pressable
            key={layer.id}
            onPress={() => onChange(layer.id)}
            hitSlop={{ top: 4, bottom: 4 }}
            style={({ pressed }) => [styles.layer, on && styles.layerOn, pressed && styles.pressed]}
            accessibilityRole="radio"
            // Without a chip the button reads its own text ("Level 3").
            accessibilityLabel={count !== undefined ? layerCountLabel(layer, count, t) : undefined}
            accessibilityState={{ checked: on }}>
            <Text style={[styles.layerText, on && styles.layerTextOn]} numberOfLines={1}>{layerLabel(layer, t)}</Text>
            {count !== undefined ? (
              <View style={[styles.count, on && styles.countOn, !count && styles.countNone]}>
                <Text style={[styles.countText, on && styles.countTextOn]}>{formatNumber(count, undefined, lang)}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  layers: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    height: LAYER_TOGGLE - Spacing.xs,
    padding: 3,
    gap: 2,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
  },
  layer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, borderRadius: Radius.pill },
  layerOn: { backgroundColor: Colors.primary },
  layerText: { ...Face.textBold, fontSize: 13, lineHeight: 17, color: Colors.ink },
  layerTextOn: { color: Colors.onPrimary },
  count: { minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary },
  countOn: { backgroundColor: Colors.surface },
  countNone: { opacity: 0.45 },
  countText: { ...Face.textBold, fontSize: 11, lineHeight: 14, color: Colors.onPrimary },
  countTextOn: { color: Colors.primary },
  pressed: { opacity: 0.6 },
});
