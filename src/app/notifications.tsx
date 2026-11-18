import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FigmaIcon } from '@/components/icons/figma-icon';
import { StepHeader } from '@/components/form-section';
import { BackLink } from '@/components/top-bar';
import { Colors, Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { useProfile } from '@/features/profile/profile-context';
import { NOTIFICATION_OPTIONS, type NotificationKind } from '@/features/settings/notification-prefs';
import { useLayoutRtl, useT } from '@/i18n';

/** Profile → Notifications: which alerts to get, saved on the profile (no push yet). */
export default function NotificationsScreen() {
  const { profile, saveSettings } = useProfile();
  const prefs = profile?.notificationPrefs ?? null;
  const t = useT('profile');
  const webRtl = useLayoutRtl() && Platform.OS === 'web';

  function toggle(kind: NotificationKind) {
    if (!prefs) return;
    saveSettings({ notificationPrefs: { ...prefs, [kind]: !prefs[kind] } });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <BackLink label={t('tab.title')} fallback="/profile" />
      <ScrollView contentContainerStyle={styles.content}>
        <StepHeader title={t('notifications.title')} subtitle={t('notifications.subtitle')} />

        {prefs && (
          <View style={styles.card}>
            {NOTIFICATION_OPTIONS.map(({ kind }, i) => {
              // A volunteer's "volunteer updates" are new requests near them, not a helper on the way.
              const helper = kind === 'volunteer' && profile?.role === 'volunteer';
              const label = helper ? t('notifications.options.volunteer.labelVolunteer') : t(`notifications.options.${kind}.label`);
              const hint = helper ? t('notifications.options.volunteer.hintVolunteer') : t(`notifications.options.${kind}.hint`);
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
                    {/* react-native-web lays its Switch out wrong in RTL (the thumb lands outside the
                        track), so draw it LTR and mirror it: "on" still puts the thumb at the end. */}
                    <View pointerEvents="none" aria-hidden style={webRtl && styles.mirror} {...(webRtl ? ({ dir: 'ltr' } as object) : {})}>
                      <Switch
                        value={prefs[kind]}
                        // Web renders a real checkbox that Tab would still reach inside aria-hidden (and
                        // Space would flip without saving). Disabled takes it out of the tab order; the
                        // colors are all set below, so it looks the same.
                        disabled={Platform.OS === 'web'}
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
  mirror: { transform: [{ scaleX: -1 }] },
});
