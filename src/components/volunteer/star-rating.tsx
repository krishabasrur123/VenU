/** Figma "star rating" (255:26852): five outlined stars; tapped ones fill orange. */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Colors, Spacing, Type } from '@/constants/theme';
import { useT } from '@/i18n';

const STAR = 'M16 3L20.08 10.73L28.68 12.22L22.59 18.48L23.84 27.12L16 23.27L8.16 27.12L9.41 18.48L3.32 12.22L11.92 10.73Z';
const WORDS = ['poor', 'notGreat', 'ok', 'good', 'excellent'] as const;

export function StarRating({ value, onChange }: { value: number; onChange: (stars: number) => void }) {
  const t = useT('volunteer');
  const word = (n: number) => (n >= 1 && n <= 5 ? t(`rating.words.${WORDS[n - 1]!}`) : '');
  return (
    <View style={styles.wrap}>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={t('rating.label')}>
        {[1, 2, 3, 4, 5].map(n => {
          const filled = n <= value;
          return (
            <Pressable
              key={n}
              onPress={() => onChange(n)}
              accessibilityRole="radio"
              accessibilityState={{ checked: n === value }}
              accessibilityLabel={t('rating.star', { count: n, word: word(n) })}
              style={({ pressed }) => [styles.star, pressed && styles.pressed]}>
              <Svg width={40} height={40} viewBox="0 0 32 32" aria-hidden>
                <Path d={STAR} stroke={Colors.warning} strokeWidth={2} strokeLinejoin="round" fill={filled ? Colors.warning : 'none'} />
              </Svg>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.word} accessibilityLiveRegion="polite">{word(value) || ' '}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: Spacing.xs },
  row: { flexDirection: 'row' },
  star: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  pressed: { transform: [{ scale: 0.92 }] },
  word: { ...Type.caption, minHeight: 17 },
});
