/** Short inline notes for actions that aren't built yet ("Voice notes are coming soon"). */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Radius, Spacing, Type } from '@/constants/theme';

/** `show(text)` sets the hint; it clears itself after a few seconds. */
export function useHint(ms = 4000) {
  const [hint, setHint] = useState<string | null>(null);
  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(null), ms);
    return () => clearTimeout(t);
  }, [hint, ms]);
  return { hint, show: setHint };
}

export function Hint({ text, style }: { text: string | null; style?: StyleProp<ViewStyle> }) {
  if (!text) return null;
  return (
    <View style={[styles.box, style]} accessibilityLiveRegion="polite" role="status">
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: Colors.primarySoft, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  text: { ...Type.caption, color: Colors.text },
});
