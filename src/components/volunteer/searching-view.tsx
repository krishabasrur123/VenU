/**
 * Between Send Request and "Volunteer found" (not in Figma): a pulsing pin, what you asked for,
 * and Cancel.
 */
import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Button } from '@/components/button';
import { Colors, Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { isolatedLanguageName } from '@/features/profile/options';
import { HELP_TYPES } from '@/features/volunteer/mock';
import { volunteerRequests } from '@/features/volunteer/request-store';
import type { HelpRequest } from '@/features/volunteer/types';
import { useT } from '@/i18n';

import { HelpIcon } from './help-icon';

export function SearchingView({ request }: { request: HelpRequest }) {
  const t = useT('volunteer');
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const asked = HELP_TYPES.filter(id => request.helpTypes.includes(id));

  return (
    <View style={styles.page}>
      <View style={styles.titles}>
        <Text style={styles.title} accessibilityRole="header">{t('searching.title')}</Text>
        <Text style={styles.subtitle} accessibilityLiveRegion="polite">{t('searching.subtitle')}</Text>
      </View>

      <View style={styles.radar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Animated.View
          style={[
            styles.ring,
            { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] },
          ]}
        />
        <View style={styles.pin}>
          <Svg width={34} height={40} viewBox="0 0 24 28" aria-hidden>
            <Path d="M12 1.5C6.8 1.5 2.5 5.6 2.5 10.8c0 6.6 8 14.2 8.6 14.8.5.5 1.3.5 1.8 0 .6-.6 8.6-8.2 8.6-14.8C21.5 5.6 17.2 1.5 12 1.5z" fill={Colors.onPrimary} />
            <Circle cx="12" cy="10.8" r="3.4" fill={Colors.primary} />
          </Svg>
        </View>
      </View>

      <Text style={styles.where}>{t('place', { spot: request.location.spot, venue: request.location.venue })}</Text>

      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>{t('searching.askedFor')}</Text>
        {asked.map(id => (
          <View key={id} style={styles.askedRow}>
            <HelpIcon type={id} size={22} />
            <Text style={Type.body}>{t(`helpTypes.${id}`)}</Text>
          </View>
        ))}
        <Text style={styles.meta}>{t('helpIn', { language: isolatedLanguageName(request.language) })}</Text>
        {request.note ? <Text style={styles.note}>{t('quoted', { text: request.note })}</Text> : null}
      </View>

      <Button label={t('cancelRequest')} variant="link" onPress={volunteerRequests.cancel} style={styles.cancel} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: Spacing.xl, alignItems: 'stretch' },
  titles: { gap: 5, paddingTop: 18 },
  title: { ...Type.title, fontSize: 26, lineHeight: 32 },
  subtitle: { fontFamily: Fonts.text, fontSize: 14, lineHeight: 18, color: Colors.text },
  radar: { height: 200, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: Colors.primary },
  pin: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  where: { ...Type.bodyStrong, textAlign: 'center' },
  summary: { gap: Spacing.sm, padding: Spacing.lg, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt },
  summaryLabel: { ...Type.label },
  askedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  meta: { ...Type.caption, marginTop: Spacing.xs },
  note: { ...Type.caption, color: Colors.text },
  cancel: { alignSelf: 'center' },
});
