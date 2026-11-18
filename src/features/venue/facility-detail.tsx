/**
 * Sheet content: one facility (name, distance and wait, tags, Directions, I'm here) and its reports.
 * Directions is the venue's one way to a facility: it draws the route on the map and shows the walk here.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { Button } from '@/components/button';
import { FigmaIcon } from '@/components/icons/figma-icon';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { languageOf, useT } from '@/i18n';
import { formatNumber } from '@/i18n/format';
import { goBack } from '@/lib/navigation';

import { Notification, ReportCard } from './cards';
import { setCurrentSpot, setCurrentVenue, useWhereAmI } from './current';
import { DirectionsPanel } from './directions-panel';
import { facilityDescription, facilityLocation, facilityMeta, facilityName, tagLabel } from './labels';
import { useFacilityReports } from './reports';
import { SheetScroll, useVenueScreen } from './venue-map-screen';
import { BackArrow, TagRow, venueText } from './ui';

export function FacilityDetail() {
  const t = useT('venue');
  const { venue, facilities, snap, setSnap, freshReport, setFreshReport, route, setRouteTo } = useVenueScreen();
  const { facilityId, submitted } = useLocalSearchParams<{ facilityId: string; submitted?: string }>();
  const facility = facilities.find(f => f.id === facilityId);
  const reports = useFacilityReports(venue.id, facilityId);
  const where = useWhereAmI();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  // Set by Directions: once the panel lays out, scroll the sheet to it.
  const scrollToRoute = useRef(false);
  const onRouteLayout = (e: LayoutChangeEvent) => {
    if (!scrollToRoute.current) return;
    scrollToRoute.current = false;
    scroll.current?.scrollTo({ y: Math.max(e.nativeEvent.layout.y - Spacing.sm, 0), animated: true });
  };

  // The form returns here with ?submitted=<id>. Closing the notification drops that param, so the
  // venue screen remembers the id and keeps "New" on the card while the user stays on this
  // facility (its reports included). Opening another facility, or the list, ends it.
  const isHere = freshReport?.venueId === venue.id && freshReport.facilityId === facilityId;
  useEffect(() => {
    if (submitted) {
      if (!isHere || freshReport.reportId !== submitted) setFreshReport({ venueId: venue.id, facilityId, reportId: submitted });
    } else if (freshReport && !isHere) {
      setFreshReport(null);
    }
  }, [venue.id, facilityId, submitted, freshReport, isHere, setFreshReport]);
  const freshId = submitted ?? (isHere ? freshReport.reportId : undefined);

  // A deep link or a tap on a pin while the sheet is lowered: bring the card into view.
  useEffect(() => {
    if (snap === 'down') setSnap('mid');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId]);

  const back = () => goBack({ pathname: '/venue/[venueId]', params: { venueId: venue.id } });

  if (!facility) {
    return (
      <SheetScroll contentContainerStyle={styles.content}>
        <BackArrow onPress={back} label={t('back.facilities')} />
        <Text style={venueText.title}>{t('facility.notFound')}</Text>
      </SheetScroll>
    );
  }

  const location = facilityLocation(facility, t);
  const name = facilityName(facility, t);
  const isMySpot = where.venueId === venue.id && where.facilityId === facility.id;

  const addReport = () => {
    setSnap('up');
    // "Submit another report": drop ?submitted first, so backing out of the form doesn't bring
    // the "Report Submitted" toast back. The card keeps "New" through freshReport.
    if (submitted) router.setParams({ submitted: undefined });
    router.push({ pathname: '/venue/[venueId]/[facilityId]/reports/new', params: { venueId: venue.id, facilityId: facility.id } });
  };

  return (
    <View style={styles.flex}>
      <SheetScroll scrollRef={scroll} contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <BackArrow onPress={back} label={t('back.facilities')} />
          {facility.accessible ? (
            <View style={styles.accessBadge} accessibilityRole="image" accessibilityLabel={t('facility.wheelchair')}>
              <FigmaIcon name="wheelchair-6dc801" size={38} color={Colors.onPrimary} />
            </View>
          ) : null}
        </View>

        <View style={styles.heading}>
          <Text style={venueText.title} accessibilityRole="header">{name}</Text>
          <Text style={venueText.caption}>{facilityDescription(facility, t)}</Text>
          <View style={styles.meta}>
            <FigmaIcon name="clock" size={16} color={Colors.textMuted} />
            <Text style={styles.metaText}>{`${facilityMeta(facility, t)} · ${location}`}</Text>
          </View>
        </View>

        {/* Up top, so it shows above the fold while the map shows the route. */}
        {route ? (
          <View onLayout={onRouteLayout}>
            <DirectionsPanel route={route} onEnd={() => setRouteTo(null)} />
          </View>
        ) : null}

        <TagRow tags={facility.tags.map(tag => ({ label: tagLabel(tag, t), tone: tag.tone }))} />

        <View style={styles.directions}>
          <Button
            label={t('facility.directions')}
            variant="dark"
            size="lg"
            icon={<FigmaIcon name="icon-28465a" size={24} color={Colors.onPrimary} />}
            onPress={() => {
              scrollToRoute.current = true;
              setRouteTo(facility.id);
              // Room for both: the route on the map above, the walk in the sheet.
              setSnap('mid');
            }}
            style={styles.directionsButton}
          />
          {/* Sets the spot the help request uses ("Near Entry 4"); shows a check once it's yours. */}
          <Button
            label={isMySpot ? t('facility.isHere') : t('facility.imHere')}
            variant="outline"
            icon={<FigmaIcon name={isMySpot ? 'check-circle' : 'location-on'} size={22} color={Colors.primary} />}
            onPress={() => { setCurrentVenue(venue.id); setCurrentSpot(facility.id); }}
            accessibilityHint={isMySpot ? undefined : t('facility.imHereHint')}
            style={styles.directionsButton}
          />
        </View>

        <View style={styles.reportsHead}>
          <Text style={venueText.title} accessibilityRole="header">{t('facility.reports')}</Text>
          <Text style={venueText.caption}>{reports ? t('facility.reportCount', { count: reports.length, number: formatNumber(reports.length, undefined, languageOf(t)) }) : ''}</Text>
        </View>
        <View style={styles.reports}>
          {reports?.map(r => (
            <ReportCard
              key={r.id}
              report={r}
              fresh={r.id === freshId}
              onPress={() => {
                setSnap('up');
                router.push({ pathname: '/venue/[venueId]/[facilityId]/reports/[reportId]', params: { venueId: venue.id, facilityId: facility.id, reportId: r.id } });
              }}
            />
          ))}
          {reports && !reports.length ? <Text style={styles.empty}>{t('facility.noReports')}</Text> : null}
          <Button
            label={t('facility.addReport')}
            variant="neutral"
            icon={<FigmaIcon name="add-circle" size={24} color={Colors.ink} />}
            onPress={addReport}
            style={styles.addButton}
          />
        </View>
      </SheetScroll>

      {submitted ? (
        <View style={styles.toastWrap} pointerEvents="box-none">
          <Notification
            title={t('submitted.title')}
            body={t('submitted.body')}
            actionLabel={t('submitted.again')}
            onAction={addReport}
            onClose={() => router.setParams({ submitted: undefined })}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: Spacing.lg },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  accessBadge: { width: 88, height: 49, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  heading: { gap: 6, marginTop: -4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  metaText: { ...venueText.caption, color: Colors.textMuted, flex: 1 },
  directions: { alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs },
  directionsButton: { minWidth: 202, minHeight: 60, borderRadius: Radius.sm },
  reportsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.md },
  reports: { gap: 20 },
  empty: { ...venueText.caption, color: Colors.textMuted },
  addButton: { marginHorizontal: Spacing.xl, borderRadius: Radius.sm },
  toastWrap: { position: 'absolute', top: 0, left: Spacing.gutter, right: Spacing.gutter },
});
