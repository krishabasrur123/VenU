/** Small pieces the venue screens share: search pill, tag pill, back arrow, section heading. */
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { FigmaIcon } from '@/components/icons/figma-icon';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useLayoutRtl, useT } from '@/i18n';

/** A tag as shown: its translated label and tone (green good news, orange heads-up). */
export interface TagView {
  label: string;
  tone: 'good' | 'note';
}

export function SearchGlyph({ size = 18, color = Colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" aria-hidden>
      <Circle cx={7.5} cy={7.5} r={5.75} stroke={color} strokeWidth={2} fill="none" />
      <Line x1={11.8} y1={11.8} x2={16} y2={16} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * Absolute offset from the start or end edge. react-native-web ignores `start`/`end`, so web gets
 * left/right by direction; native keeps `start`/`end`, which flip on their own.
 * e.g. inset('start', 10, rtl) → { left: 10 } (en, web), { right: 10 } (ar, web), { start: 10 } (native)
 */
export function inset(edge: 'start' | 'end', value: number, rtl: boolean) {
  if (Platform.OS !== 'web') return edge === 'start' ? { start: value } : { end: value };
  return (edge === 'start') !== rtl ? { left: value } : { right: value };
}

/** Figma "Search Field": a white pill with a magnifier; × clears it. */
export function SearchField({ value, onChangeText, placeholder, accessibilityLabel }: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  accessibilityLabel: string;
}) {
  const t = useT('venue');
  return (
    <View style={styles.search}>
      <SearchGlyph />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? t('search.placeholder')}
        placeholderTextColor={Colors.textFaint}
        accessibilityLabel={accessibilityLabel}
        autoCorrect={false}
        returnKeyType="search"
        style={styles.searchInput}
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} style={styles.clear} accessibilityRole="button" accessibilityLabel={t('search.clear')}>
          <FigmaIcon name="icon-button-c1cfb2" size={28} color={Colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Solid tag from the facility popup: green for good news ("Accessible"), orange for a heads-up. */
export function TagPill({ tag }: { tag: TagView }) {
  const good = tag.tone === 'good';
  return (
    <View style={[styles.tag, good ? styles.tagGood : styles.tagNote]}>
      <Text style={[styles.tagText, good && styles.tagTextGood]}>{tag.label}</Text>
    </View>
  );
}

export function TagRow({ tags }: { tags: TagView[] }) {
  const t = useT('venue');
  if (!tags.length) return null;
  return (
    <View style={styles.tagBlock}>
      <Text style={styles.tagsLabel}>{t('tags.label')}</Text>
      <View style={styles.tagRow}>
        {tags.map(tag => <TagPill key={tag.label} tag={tag} />)}
      </View>
    </View>
  );
}

/** The 40pt Figma "Arrow left", in a 44pt target, pulled to the start so the arrow itself sits on the gutter. Points right in RTL. */
export function BackArrow({ onPress, label }: { onPress: () => void; label: string }) {
  const rtl = useLayoutRtl();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.back, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={label}>
      <View style={rtl && styles.flip}>
        <FigmaIcon name="arrow-left" size={34} color={Colors.ink} />
      </View>
    </Pressable>
  );
}

/** A grey note that answers a tap on something not built yet ("Coming soon"). */
export function InlineNote({ children }: { children: string }) {
  return (
    <Text style={styles.note} accessibilityLiveRegion="polite">{children}</Text>
  );
}

export const venueText = StyleSheet.create({
  /** 23pt Alexandria titles in Figma ("Facilities Near You", "Gate 2"). */
  title: { fontFamily: Fonts.display, fontSize: 24, lineHeight: 30, color: Colors.text },
  /** 11pt Albert Sans captions in Figma, 13 here. */
  caption: { fontFamily: Fonts.text, fontSize: 13, lineHeight: 17, color: Colors.text },
  /** 13pt Alexandria labels in Figma, 15 here. */
  label: { fontFamily: Fonts.display, fontSize: 15, lineHeight: 20, color: Colors.text },
});

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 44,
    paddingStart: 14,
    paddingEnd: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.controlBorder,
    backgroundColor: Colors.surface,
  },
  searchInput: { flex: 1, fontFamily: Fonts.display, fontSize: 15, color: Colors.text, paddingVertical: 10, outlineStyle: 'none' } as object,
  clear: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  tagBlock: { gap: 6 },
  tagsLabel: { fontFamily: Fonts.text, fontSize: 13, lineHeight: 17, color: Colors.text },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tag: { minHeight: 28, minWidth: 78, paddingHorizontal: 14, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  tagGood: { backgroundColor: Colors.successStrong },
  tagNote: { backgroundColor: Colors.warning },
  tagText: { fontFamily: Fonts.textMedium, fontSize: 13, lineHeight: 17, color: Colors.ink },
  tagTextGood: { fontFamily: Fonts.textBold, color: Colors.onPrimary },

  // The 34pt glyph starts 5.6pt into its box, which is centred in the 44pt target: 5 + 5.6 ≈ 11.
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginStart: -11 },
  flip: { transform: [{ scaleX: -1 }] },
  pressed: { opacity: 0.6 },
  note: { fontFamily: Fonts.text, fontSize: 13, lineHeight: 18, color: Colors.textMuted, textAlign: 'center' },
});
