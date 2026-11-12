import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FigmaIcon } from '@/components/icons/figma-icon';
import { StepHeader } from '@/components/form-section';
import { BackLink } from '@/components/top-bar';
import { Colors, Fonts, Radius, Spacing, Type } from '@/constants/theme';
import {
  loadNotificationPrefs,
  NOTIFICATION_OPTIONS,
  saveNotificationPrefs,
  type NotificationKind,
  type NotificationPrefs,
} from '@/features/settings/notification-prefs';
import { useT } from '@/i18n';

/** Profile → Notifications: which alerts to get, saved on this device (no push yet). */
export default function NotificationsScreen() {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const t = useT('profile');

  useEffect(() => {
    let live = true;
    loadNotificationPrefs().then(p => live && setPrefs(p));
    return () => { live = false; };
  }, []);

  function toggle(kind: NotificationKind) {
    if (!prefs) return;
    const next = { ...prefs, [kind]: !prefs[kind] };
    setPrefs(next);
    saveNotificationPrefs(next);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <BackLink label={t('tab.title')} fallback="/profile" />
      <ScrollView contentContainerStyle={styles.content}>
        <StepHeader title={t('notifications.title')} subtitle={t('notifications.subtitle')} />

        {prefs && (
          <View style={styles.card}>
            {NOTIFICATION_OPTIONS.map(({ kind }, i) => {
              const label = t(`notifications.options.${kind}.label`);
              const hint = t(`notifications.options.${kind}.hint`);
              return (
                <View key={kind}>
                  {/* The whole row is the switch; the Switch itself only shows the state. */}
                  <Pressable
                    onPress={() => toggle(kind)}
                    accessibilityRole="switch"
                    accessibilityLabel={label}
                    accessibilityHint={hint}
                    accessibilityState={{ checked: prefs[kind] }}
                    aria-checked={prefs[kind]}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                    <View style={styles.rowText}>
                      <Text style={styles.label}>{label}</Text>
                      <Text style={styles.hint}>{hint}</Text>
                    </View>
                    <View pointerEvents="none" aria-hidden>
                      <Switch
                        value={prefs[kind]}
                        trackColor={{ false: Colors.controlBorder, true: Colors.primary }}
                        thumbColor={Colors.surface}
                        // react-native-web's prop for the "on" thumb color.
                        {...({ activeThumbColor: Colors.surface } as object)}
                      />
                    </View>
                  </Pressable>
                  {i < NOTIFICATION_OPTIONS.length - 1 && <View style={styles.divider} />}
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.note}>
          <FigmaIcon name="volume" size={20} color={Colors.textMuted} />
          <Text style={styles.noteText}>{t('notifications.note')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: Spacing.gutter, paddingTop: Spacing.lg, paddingBottom: 48 },
  card: { borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.controlBorder, backgroundColor: Colors.surface, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.md },
  rowPressed: { backgroundColor: Colors.surfaceAlt },
  rowText: { flex: 1, gap: 2 },
  label: { fontFamily: Fonts.display, fontSize: 15, lineHeight: 20, color: Colors.text },
  hint: { ...Type.caption },
  divider: { height: 1, backgroundColor: Colors.divider, marginStart: Spacing.lg },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginTop: Spacing.lg, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt },
  noteText: { ...Type.caption, flex: 1, paddingTop: 1 },
});
