/**
 * The venue header's category chips: one row that scrolls sideways, starting and ending on the
 * page gutter, with a soft fade on whichever edge has more chips behind it.
 */
import { useCallback, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Chip } from '@/components/chip';
import { Colors, Spacing } from '@/constants/theme';
import { useLayoutRtl, useT } from '@/i18n';

import { CATEGORIES } from './categories';
import { categoryLabel } from './labels';
import { inset } from './ui';
import type { FacilityCategory } from './types';

const FADE = 36;

/** A strip that fades the header background in over the chips at one edge (mirrored with the layout). */
function EdgeFade({ side, rtl }: { side: 'start' | 'end'; rtl: boolean }) {
  const id = `venue-chip-fade-${side}`;
  return (
    <View pointerEvents="none" style={[styles.fade, inset(side, 0, rtl), rtl && styles.flip]} aria-hidden>
      <Svg width={FADE} height="100%">
        <Defs>
          <LinearGradient id={id} x1={side === 'start' ? 1 : 0} y1={0} x2={side === 'start' ? 0 : 1} y2={0}>
            <Stop offset={0} stopColor={Colors.bg} stopOpacity={0} />
            <Stop offset={1} stopColor={Colors.bg} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={FADE} height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

export function CategoryChips({ value, onChange }: {
  value: FacilityCategory | null;
  onChange: (c: FacilityCategory | null) => void;
}) {
  const t = useT('venue');
  const rtl = useLayoutRtl();
  const size = useRef({ view: 0, content: 0, x: 0 });
  const [edges, setEdges] = useState({ start: false, end: false });

  const update = useCallback(() => {
    const { view, content, x } = size.current;
    const next = { start: x > 2, end: view > 0 && x + view < content - 2 };
    setEdges(prev => (prev.start === next.start && prev.end === next.end ? prev : next));
  }, []);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Right-to-left on web, the row starts at scrollLeft 0 and goes negative; measure from the start edge.
    const x = e.nativeEvent.contentOffset.x;
    size.current.x = rtl && Platform.OS === 'web' ? Math.abs(x) : x;
    update();
  };

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        onLayout={(e: LayoutChangeEvent) => { size.current.view = e.nativeEvent.layout.width; update(); }}
        onContentSizeChange={w => { size.current.content = w; update(); }}
        onScroll={onScroll}
        scrollEventThrottle={32}
        accessibilityRole="radiogroup"
        accessibilityLabel={t('category.groupLabel')}>
        <Chip label={t('category.all')} role="radio" selected={value === null} onPress={() => onChange(null)} />
        {CATEGORIES.map(c => (
          <Chip key={c} label={categoryLabel(c, t)} role="radio" selected={value === c} onPress={() => onChange(value === c ? null : c)} />
        ))}
      </ScrollView>
      {edges.start ? <EdgeFade side="start" rtl={rtl} /> : null}
      {edges.end ? <EdgeFade side="end" rtl={rtl} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Same 20pt gutter as the page at both ends; equal space above and below the chips.
  row: { gap: Spacing.sm, paddingHorizontal: Spacing.gutter, paddingVertical: Spacing.md },
  fade: { position: 'absolute', top: 0, bottom: 0, width: FADE },
  flip: { transform: [{ scaleX: -1 }] },
});
