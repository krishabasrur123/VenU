/**
 * The chips for what a volunteer can help with (Figma 554:5227 "What you can help with", 566:4451
 * Profile, and "Help in:" on 554:5535 Finding a Volunteer):
 * - languages: pale blue with a blue outline, named in the app language, e.g. [English] [Vietnamese];
 * - trainings: filled tags, green for getting around (wheelchair, sighted guide, sign language) and
 *   orange for care (first aid, mental health), e.g. [Wheelchair trained] [First aid].
 * Read-only labels, not buttons.
 */
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Face, Radius, Spacing } from '@/constants/theme';
import { labelFor, TRAININGS } from '@/features/profile/options';
import { uiLanguageName } from '@/features/profile/summary';
import type { Training } from '@/features/profile/types';
import { useT } from '@/i18n';

/** Which trainings get the orange tag; the rest are green. */
const CARE_TRAININGS: readonly Training[] = ['first_aid', 'mental_health'];

export function LanguageChips({ codes }: { codes: string[] }) {
  const tp = useT('profile');
  return (
    <View style={styles.row}>
      {codes.map(code => (
        <Text key={code} style={styles.language}>{uiLanguageName(code, tp)}</Text>
      ))}
    </View>
  );
}

export function TrainingChips({ trainings }: { trainings: Training[] }) {
  const tp = useT('profile');
  return (
    <View style={styles.row}>
      {trainings.map(skill => {
        const care = CARE_TRAININGS.includes(skill);
        return (
          <Text key={skill} style={[styles.training, care ? styles.care : styles.mobility]}>
            {labelFor(TRAININGS, skill, tp)}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  // Figma: #DFEBFD, 1px #1D5DBC, radius 8, 16px medium.
  language: {
    ...Face.textMedium,
    fontSize: 15,
    lineHeight: 20,
    color: Colors.text,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
    overflow: 'hidden',
  },
  // Figma: filled, radius 8, 11px; 13px here as elsewhere in the app.
  training: {
    ...Face.text,
    fontSize: 13,
    lineHeight: 17,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  // White on successStrong (5.1:1); dark text on the orange, which is too light behind white (2:1).
  mobility: { backgroundColor: Colors.successStrong, color: Colors.onPrimary },
  care: { backgroundColor: Colors.warning, color: Colors.text },
});
