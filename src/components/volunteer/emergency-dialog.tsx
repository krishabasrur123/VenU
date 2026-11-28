/**
 * "Need emergency help?" (Figma notif-d): Call 911, Call venue staff (when the venue's number is
 * known), or close. Escape (web), Android back, the X and "not an emergency" close it. No tap-outside
 * close: on web the first focusable element gets focus, and that should be the X, not the backdrop.
 */
import { useId, useRef, type ComponentRef } from 'react';
import { AccessibilityInfo, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Colors, Face, Radius, Shadow, Spacing, Type, WEB_COLUMN_MAX } from '@/constants/theme';
import { dial } from '@/features/venue/contacts';
import { useWhereAmI } from '@/features/venue/current';
import { useT } from '@/i18n';

import { VenueStaffButtons } from './venue-staff-buttons';

interface EmergencyDialogProps {
  visible: boolean;
  onClose: () => void;
}

export function EmergencyDialog({ visible, onClose }: EmergencyDialogProps) {
  const t = useT('volunteer');
  const { venueId } = useWhereAmI();
  const titleId = useId();
  const title = useRef<ComponentRef<typeof Text>>(null);

  // Native: move the screen reader to the title when the dialog opens (web focuses the X).
  function focusTitle() {
    if (Platform.OS !== 'web' && title.current) AccessibilityInfo.sendAccessibilityEvent(title.current, 'focus');
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onShow={focusTitle} aria-labelledby={titleId}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.header}>
            <Text ref={title} nativeID={titleId} style={styles.title} accessibilityRole="header">{t('emergency.dialogTitle')}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('emergency.close')}
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
              <Text style={styles.closeGlyph} aria-hidden>×</Text>
            </Pressable>
          </View>
          <Text style={styles.body}>{t('emergency.dialogBody')}</Text>

          <Pressable
            onPress={() => dial('911')}
            accessibilityRole="button"
            accessibilityLabel={t('emergency.call911')}
            style={({ pressed }) => [styles.call911, pressed && styles.pressed]}>
            <Text style={styles.call911Label}>{t('emergency.call911')}</Text>
          </Pressable>
          <VenueStaffButtons venueId={venueId} />
          <Button label={t('emergency.notEmergency')} variant="link" onPress={onClose} style={styles.dismiss} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.gutter, backgroundColor: 'rgba(0,0,0,0.45)' },
  card: {
    width: '100%',
    maxWidth: WEB_COLUMN_MAX - 2 * Spacing.gutter,
    gap: Spacing.md,
    padding: Spacing.gutter,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    ...Shadow.float,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  title: { ...Type.title, flex: 1, fontSize: 26, lineHeight: 32 },
  close: { width: 36, height: 36, marginTop: -4, marginEnd: -8, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.pill },
  closeGlyph: { fontSize: 30, lineHeight: 32, color: Colors.ink },
  body: { ...Type.body, marginBottom: Spacing.xs },
  call911: { minHeight: 52, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, backgroundColor: Colors.danger },
  call911Label: { ...Type.buttonLarge, ...Face.displayMedium, color: Colors.onPrimary },
  pressed: { opacity: 0.85 },
  dismiss: { alignSelf: 'center' },
});
