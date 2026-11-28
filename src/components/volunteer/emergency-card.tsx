/** The pink "Emergency? Call 911 now" card; opens "Need emergency help?" (Call 911 or venue staff). */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FigmaIcon } from '@/components/icons/figma-icon';
import { Colors, Face, Fonts, Radius, Spacing } from '@/constants/theme';
import { useLayoutRtl, useT } from '@/i18n';

import { EmergencyDialog } from './emergency-dialog';

export function EmergencyCard() {
  const t = useT('volunteer');
  const rtl = useLayoutRtl();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('emergency.label')}
        accessibilityHint={t('emergency.hint')}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <FigmaIcon name="alert-triangle" size={44} color={Colors.danger} />
        <View style={styles.text}>
          <Text style={styles.title}>{t('emergency.title')}</Text>
          <Text style={styles.sub}>{t('emergency.call')}</Text>
        </View>
        <View style={rtl && styles.flip}>
          <FigmaIcon name="group-2-77b14c" size={36} color={Colors.danger} />
        </View>
      </Pressable>
      <EmergencyDialog visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 73,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
    paddingStart: Spacing.gutter,
    paddingEnd: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.emergencySoft,
  },
  pressed: { opacity: 0.85 },
  flip: { transform: [{ scaleX: -1 }] },
  text: { flex: 1, gap: 2 },
  title: { ...Face.displayMedium, fontSize: 16, lineHeight: 20, color: Colors.danger },
  sub: { fontFamily: Fonts.text, fontSize: 14, lineHeight: 18, color: Colors.danger },
});
