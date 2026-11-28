/**
 * "No volunteer is free right now" (user flow: Volunteer Not Found): the search ran out of time and
 * the request was withdrawn. Search again sends it anew, or call venue staff, or cancel.
 */
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Button } from '@/components/button';
import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import { announce } from '@/features/voice/announce';
import { volunteerRequests } from '@/features/volunteer/request-store';
import type { HelpRequest } from '@/features/volunteer/types';
import { useT } from '@/i18n';

import { RequestSummary } from './searching-view';
import { VenueStaffButtons } from './venue-staff-buttons';

export function NotFoundView({ request }: { request: HelpRequest }) {
  const t = useT('volunteer');
  const title = t('searching.notFoundTitle');
  const body = t('searching.notFoundBody');

  // The screen changed under them: say why.
  useEffect(() => { announce(`${title}. ${body}`); }, [title, body]);

  return (
    <View style={styles.page}>
      <View style={styles.titles}>
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        <Text style={styles.subtitle}>{body}</Text>
      </View>

      <View style={styles.art} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.pin}>
          <Svg width={34} height={40} viewBox="0 0 24 28" aria-hidden>
            <Path d="M12 1.5C6.8 1.5 2.5 5.6 2.5 10.8c0 6.6 8 14.2 8.6 14.8.5.5 1.3.5 1.8 0 .6-.6 8.6-8.2 8.6-14.8C21.5 5.6 17.2 1.5 12 1.5z" fill={Colors.surface} />
            <Circle cx="12" cy="10.8" r="3.4" fill={Colors.textFaint} />
          </Svg>
        </View>
      </View>

      <RequestSummary request={request} />

      <View style={styles.actions}>
        <Button label={t('searching.keepSearching')} size="lg" onPress={() => void volunteerRequests.keepSearching()} />
        <VenueStaffButtons venueId={request.location.venueId} />
        <Button label={t('cancelRequest')} variant="link" onPress={volunteerRequests.cancel} style={styles.cancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: Spacing.xl, alignItems: 'stretch' },
  titles: { gap: 5, paddingTop: 18 },
  title: { ...Type.title, fontSize: 26, lineHeight: 32 },
  subtitle: { fontFamily: Fonts.text, fontSize: 15, lineHeight: 20, color: Colors.text },
  art: { alignItems: 'center' },
  pin: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.textFaint, alignItems: 'center', justifyContent: 'center' },
  actions: { gap: Spacing.md },
  cancel: { alignSelf: 'center' },
});
