/**
 * The sheet's directions to the open facility, while the map shows the dashed route: walk time and
 * steps, where the walk starts, then three steps (start, heading and distance, arrive).
 * e.g. "6 min walk · about 560 steps / From Entry 4 / 1. Start at Entry 4. 2. Head southeast…"
 */
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Colors, Face, Fonts, Radius, Spacing } from '@/constants/theme';
import { languageOf, useT } from '@/i18n';
import { formatNumber } from '@/i18n/format';

import type { Route } from './directions';
import { facilityLocation, facilityName } from './labels';
import { venueText } from './ui';

export function DirectionsPanel({ route, onEnd }: { route: Route; onEnd: () => void }) {
  const t = useT('venue');
  const lang = languageOf(t);
  const num = (n: number) => formatNumber(n, undefined, lang);
  const from = facilityName(route.from, t);
  const name = facilityName(route.to, t);
  const { minutes, steps, meters, heading } = route.walk;
  const lines = route.here
    ? [t('directions.here')]
    : [
        t('directions.stepStart', { from }),
        t('directions.stepHead', { direction: t(`directions.dir.${heading}`), meters: num(Math.round(meters / 10) * 10) }),
        t('directions.stepArrive', { name, location: facilityLocation(route.to, t) }),
      ];

  return (
    <View style={styles.panel} accessibilityLiveRegion="polite">
      <Text style={styles.title} accessibilityRole="header">{t('directions.title')}</Text>
      {route.here ? null : (
        <Text style={styles.summary}>
          {`${t('walk', { count: minutes, number: num(minutes) })} · ${t('directions.steps', { count: steps, number: num(steps) })}`}
        </Text>
      )}
      <Text style={styles.from}>{route.fromIsMine ? t('directions.from', { from }) : t('directions.fromArrival', { from })}</Text>
      <View style={styles.steps}>
        {lines.map((line, i) => (
          <View key={line} style={styles.step}>
            {lines.length > 1 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{num(i + 1)}</Text>
              </View>
            ) : null}
            <Text style={styles.stepText}>{line}</Text>
          </View>
        ))}
      </View>
      <Button label={t('directions.end')} variant="link" onPress={onEnd} style={styles.end} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: Spacing.sm, padding: Spacing.lg, borderRadius: Radius.md, backgroundColor: Colors.primarySoft },
  title: { ...venueText.label, color: Colors.primary },
  summary: { fontFamily: Fonts.display, fontSize: 20, lineHeight: 26, color: Colors.text },
  from: { ...venueText.caption, color: Colors.textMuted },
  steps: { gap: Spacing.sm, marginTop: 2 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  badge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary },
  badgeText: { ...Face.textBold, fontSize: 12, lineHeight: 16, color: Colors.onPrimary },
  stepText: { ...venueText.caption, flex: 1, paddingTop: 2 },
  end: { alignSelf: 'flex-start', minHeight: 36 },
});
