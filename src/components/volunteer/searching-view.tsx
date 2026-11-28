/**
 * Between Send Request and "Volunteer found" (Figma 554:5535 Finding a Volunteer): where they are,
 * the VenU heart drawing itself over and over while the search runs, what they asked for (help
 * type, "Help in:" languages, their note), Cancel, then the one sponsor slot.
 */
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Button } from '@/components/button';
import { LogoReveal } from '@/components/logo-reveal';
import { Colors, Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { meetSpotLabel, meetVenueName } from '@/features/volunteer/meet-point';
import { HELP_TYPES } from '@/features/volunteer/mock';
import { volunteerRequests } from '@/features/volunteer/request-store';
import type { HelpRequest, MeetPoint, Notice } from '@/features/volunteer/types';
import { useT } from '@/i18n';

import { AppLanguagePill } from './app-language-pill';
import { HelpIcon } from './help-icon';
import { NoteBanner } from './note-banner';
import { LanguageChips } from './skill-chips';
import { SponsorBanner } from './sponsor-banner';
import { useStartAligned } from './start-aligned';

/** `notice`: why it's searching again, e.g. "Your volunteer had to leave. Finding someone else." */
export function SearchingView({ request, notice }: { request: HelpRequest; notice?: Notice | null }) {
  const t = useT('volunteer');

  return (
    <View style={styles.page}>
      {notice ? (
        <NoteBanner tone={notice.tone} text={t(`notice.${notice.key}`, { name: notice.params?.name ?? '' })} onDismiss={volunteerRequests.dismissNotice} />
      ) : null}
      <View style={styles.header}>
        <AppLanguagePill />
        <View style={styles.titles}>
          <Text style={styles.title} accessibilityRole="header">{t('searching.title')}</Text>
          <Text style={styles.subtitle} accessibilityLiveRegion="polite">{t('searching.subtitle')}</Text>
        </View>
      </View>

      <MeetCard point={request.location} />

      {/* The waiting visual: draw, hold, fade, redraw. Still with Reduce Motion on. */}
      <View style={styles.logo}>
        <LogoReveal size={140} loop />
      </View>

      <AskedCard request={request} />

      <Button label={t('cancelRequest')} variant="link" onPress={volunteerRequests.cancel} style={styles.cancel} />

      {/* The one ad slot here: after Cancel, in the flow, so it never covers the request or the notice. */}
      <SponsorBanner />
    </View>
  );
}

/** Where they are and what they asked for; also under "No volunteer is free right now". */
export function RequestSummary({ request }: { request: HelpRequest }) {
  return (
    <>
      <MeetCard point={request.location} />
      <AskedCard request={request} />
    </>
  );
}

/** Solid map pin, as on the volunteer home's location card. */
function Pin() {
  return (
    <Svg width={30} height={30} viewBox="0 0 24 24" aria-hidden>
      <Path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2z" fill={Colors.ink} />
    </Svg>
  );
}

/** "Near Entry 4" over "SoFi Stadium", or just the venue when no spot was chosen. */
function MeetCard({ point }: { point: MeetPoint }) {
  const t = useT('volunteer');
  const tv = useT('venue');
  const near = meetSpotLabel(point, tv, t);
  const venue = meetVenueName(point);
  const startAligned = useStartAligned();
  return (
    <View style={styles.meet} accessible accessibilityLabel={near ? t('home.locationLabel', { place: near, venue }) : venue}>
      <Pin />
      <View style={styles.meetText}>
        <Text style={[styles.spot, startAligned]}>{near ?? venue}</Text>
        {near ? <Text style={[styles.venue, startAligned]}>{venue}</Text> : null}
      </View>
    </View>
  );
}

/** "You asked for" each help type, "Help in:" the request's language, and the note in quotes. */
function AskedCard({ request }: { request: HelpRequest }) {
  const t = useT('volunteer');
  const asked = HELP_TYPES.filter(id => request.helpTypes.includes(id));
  return (
    <View style={styles.summary}>
      <View style={styles.group}>
        <Text style={styles.label}>{t('searching.askedFor')}</Text>
        {asked.map(id => (
          <View key={id} style={styles.askedRow}>
            <HelpIcon type={id} size={26} />
            <Text style={styles.askedText}>{t(`helpTypes.${id}`)}</Text>
          </View>
        ))}
      </View>
      <View style={styles.group}>
        <Text style={styles.label}>{t('searching.helpInLabel')}</Text>
        <LanguageChips codes={[request.language]} />
      </View>
      {request.note ? <Text style={styles.note}>{t('quoted', { text: request.note })}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: Spacing.xl, alignItems: 'stretch' },
  header: { gap: Spacing.xs },
  titles: { gap: 5 },
  title: { ...Type.title, fontSize: 26, lineHeight: 32 },
  subtitle: { fontFamily: Fonts.text, fontSize: 14, lineHeight: 18, color: Colors.text },
  // Figma: white card, 1px grey outline, radius 10, the pin then two lines.
  meet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    minHeight: 62,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.controlBorder,
    backgroundColor: Colors.surface,
  },
  meetText: { flex: 1, gap: 2 },
  spot: { ...Type.bodyStrong },
  venue: { fontFamily: Fonts.text, fontSize: 13, lineHeight: 16, color: Colors.text },
  logo: { alignItems: 'center', paddingVertical: Spacing.lg },
  summary: { gap: Spacing.lg, padding: Spacing.lg, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.controlBorder, backgroundColor: Colors.surface },
  group: { gap: Spacing.sm },
  label: { ...Type.body, fontSize: 16, lineHeight: 21 },
  // Figma: each help type as an outlined row, icon then label.
  askedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    minHeight: 44,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.controlBorder,
  },
  askedText: { ...Type.body, flex: 1 },
  note: { ...Type.body, color: Colors.text },
  cancel: { alignSelf: 'center' },
});
