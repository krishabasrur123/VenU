/**
 * Figma "Add a note (optional)" field (506:9530, in Find a Volunteer v3 506:9816): a gray row with
 * a pencil, the label, and camera + mic shortcuts. The row opens (and closes) the note box under
 * it; the camera adds a picture and the mic starts dictation, each opening the box too.
 * e.g. <NoteToggle open={open} onToggle={…} onAddPicture={pick} onSpeak={talk} listening={false} />
 */
import { Trans } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { Colors, Radius, Shadow, Spacing, Type } from '@/constants/theme';
import { toggleState } from '@/features/voice/announce';
import { useT } from '@/i18n';

interface NoteToggleProps {
  open: boolean;
  onToggle: () => void;
  onAddPicture: () => void;
  onSpeak: () => void;
  /** Dictation is on: the mic shows its on state. */
  listening: boolean;
}

const STROKE = { strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;

export function NoteToggle({ open, onToggle, onAddPicture, onSpeak, listening }: NoteToggleProps) {
  const t = useT('volunteer');
  const tc = useT('common');
  return (
    <View style={styles.field}>
      {/* Three buttons side by side, not nested: a button inside a button isn't allowed on web. */}
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={t('note.labelPlain')}
        accessibilityState={{ expanded: open }}
        // react-native-web reads only aria-* for state.
        aria-expanded={open}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
        <Svg width={22} height={22} viewBox="0 0 24 24" aria-hidden>
          <Path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" stroke={Colors.ink} {...STROKE} />
        </Svg>
        <Text style={styles.label} numberOfLines={2}>
          {/* One sentence for translators; the "(optional)" part is muted. */}
          <Trans t={t} i18nKey="note.label" components={{ muted: <Text style={styles.optional} /> }} />
        </Text>
      </Pressable>
      <Pressable
        onPress={onAddPicture}
        accessibilityRole="button"
        accessibilityLabel={tc('media.addPicture')}
        hitSlop={4}
        style={({ pressed }) => [styles.icon, pressed && styles.pressed]}>
        <Svg width={30} height={30} viewBox="0 0 24 24" aria-hidden>
          <Path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.6l1.6-2.2h6.6L16.9 7h2.6A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" stroke={Colors.ink} {...STROKE} />
          <Circle cx={12} cy={12.8} r={3.4} stroke={Colors.ink} {...STROKE} />
        </Svg>
      </Pressable>
      <Pressable
        onPress={onSpeak}
        accessibilityRole="button"
        accessibilityLabel={listening ? tc('media.listening') : t('note.speak')}
        {...toggleState(listening)}
        hitSlop={4}
        style={({ pressed }) => [styles.icon, listening && styles.iconOn, pressed && styles.pressed]}>
        <Svg width={26} height={26} viewBox="0 0 24 24" aria-hidden>
          <Rect x={9} y={2.5} width={6} height={12} rx={3} stroke={listening ? Colors.onPrimary : Colors.ink} {...STROKE} />
          <Path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" stroke={listening ? Colors.onPrimary : Colors.ink} {...STROKE} />
        </Svg>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Figma: 44 tall, #F5F5F5, 1px gray outline, radius 10, the card shadow.
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingEnd: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.controlBorder,
    backgroundColor: Colors.surfaceAlt,
    ...Shadow.card,
  },
  main: {
    flex: 1,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingStart: Spacing.lg,
    paddingEnd: Spacing.sm,
    borderTopStartRadius: Radius.md,
    borderBottomStartRadius: Radius.md,
  },
  pressed: { opacity: 0.6 },
  label: { ...Type.body, fontSize: 16, lineHeight: 21, flexShrink: 1 },
  optional: { color: Colors.textFaint },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  iconOn: { backgroundColor: Colors.primary },
});
