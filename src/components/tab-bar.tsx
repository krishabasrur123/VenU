/**
 * Bottom tab bar from the Figma "Tab Bar" component (266:27343): a white pill floating over the
 * screen, the active tab's icon in a dark circle.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FigmaIcon, type FigmaIconName } from '@/components/icons/figma-icon';
import { Colors, Fonts, Shadow } from '@/constants/theme';
import { useT } from '@/i18n';

export type Tab = 'volunteer' | 'venue' | 'profile';

const BAR_HEIGHT = 68;
const BAR_GAP = 12; // between the bar and the bottom edge (or home indicator)

/** Bottom padding a scrolling tab screen needs so its last item clears the bar (safe area not included). */
export const NAV_BAR_CLEARANCE = BAR_HEIGHT + BAR_GAP + 24;

// Labels are common:tabs.<key>.
const TABS: { key: Tab; icon: FigmaIconName }[] = [
  { key: 'volunteer', icon: 'tab-volunteer' },
  { key: 'venue', icon: 'tab-venue' },
  { key: 'profile', icon: 'tab-profile' },
];

export function TabBar({ active, onPress }: { active: Tab; onPress: (tab: Tab) => void }) {
  const insets = useSafeAreaInsets();
  const t = useT('common');
  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, BAR_GAP) }]} pointerEvents="box-none">
      <View style={styles.bar} accessibilityRole="tablist">
        {TABS.map(({ key, icon }) => {
          const selected = active === key;
          const label = t(`tabs.${key}`);
          return (
            <Pressable
              key={key}
              onPress={() => onPress(key)}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={label}>
              <View style={[styles.circle, selected && styles.circleActive]}>
                <FigmaIcon name={icon} size={selected ? 26 : 28} color={selected ? Colors.onPrimary : Colors.ink} />
              </View>
              <Text style={[styles.label, selected && styles.labelActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: 16 },
  bar: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 396,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    backgroundColor: Colors.surface,
    paddingHorizontal: 24,
    ...Shadow.float,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 2 },
  pressed: { opacity: 0.7 },
  circle: { width: 45, height: 45, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  circleActive: { backgroundColor: Colors.inkDeep },
  label: { fontFamily: Fonts.display, fontSize: 13, lineHeight: 16, color: Colors.text, marginTop: -2 },
  labelActive: { fontFamily: Fonts.displayMedium },
});
