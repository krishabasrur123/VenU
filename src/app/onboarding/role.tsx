import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { StepHeader } from '@/components/form-section';
import { FigmaIcon, type FigmaIconName } from '@/components/icons/figma-icon';
import { Colors, Fonts, Radius, Spacing, Type } from '@/constants/theme';
import type { Role } from '@/features/profile/types';
import { useT } from '@/i18n';

// Text: onboarding:role.<value>Title / <value>Body.
const ROLES: { value: Role; icon: FigmaIconName }[] = [
  { value: 'visitor', icon: 'person' },
  { value: 'volunteer', icon: 'volunteer' },
];

/**
 * Before "Set up your profile": visitor or volunteer, since the two get different questions.
 * The language is chosen on the landing page's language pill and in profile setup.
 */
export default function RoleStep() {
  const [role, setRole] = useState<Role | null>(null);
  const t = useT('onboarding');
  const tc = useT('common');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <StepHeader title={t('role.title')} subtitle={t('role.subtitle')} />

        <View style={styles.cards} accessibilityRole="radiogroup">
          {ROLES.map(r => {
            const on = role === r.value;
            const title = t(`role.${r.value}Title`);
            const body = t(`role.${r.value}Body`);
            return (
              <Pressable
                key={r.value}
                onPress={() => setRole(r.value)}
                style={({ pressed }) => [styles.card, on && styles.cardOn, pressed && !on && styles.cardPressed]}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${title}. ${body}`}>
                <View style={[styles.iconTile, on && styles.iconTileOn]}>
                  <FigmaIcon name={r.icon} size={26} color={on ? Colors.onPrimary : Colors.ink} />
                </View>
                <View style={styles.cardText}>
                  <Text style={[styles.cardTitle, on && styles.textOn]}>{title}</Text>
                  <Text style={Type.caption}>{body}</Text>
                </View>
                <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.radioDot} />}</View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.spacer} />
        <Button
          label={tc('actions.continue')}
          size="lg"
          disabled={!role}
          onPress={() => role && router.push({ pathname: '/onboarding/profile', params: { role } })}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  content: { flexGrow: 1, paddingHorizontal: Spacing.gutter, paddingTop: 48, paddingBottom: Spacing.xl },
  cards: { gap: Spacing.lg },
  // Same outline as the Figma text inputs: 2px gray, radius 10.
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: Colors.controlBorder,
    backgroundColor: Colors.surface,
  },
  cardOn: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  cardPressed: { backgroundColor: Colors.surfaceAlt },
  iconTile: { width: 48, height: 48, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  iconTileOn: { backgroundColor: Colors.primary },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { fontFamily: Fonts.display, fontSize: 17, lineHeight: 22, color: Colors.text },
  textOn: { color: Colors.primary },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.controlBorder, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: Colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  spacer: { flexGrow: 1, minHeight: Spacing.xxl },
});
