/** Venue list cards: Stadium Card (151:16024), facility row (Frame 2209), Report (134:15181), Notification (276:28618). */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FigmaIcon } from '@/components/icons/figma-icon';
import { Colors, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { useLayoutRtl, useT } from '@/i18n';

import { FacilityIcon } from './categories';
import { eventsLabel, facilityMeta } from './labels';
import type { FacilityReport } from './reports';
import { MAP_BACKGROUND, VenueDrawing } from './stadium-map';
import type { Facility, Venue } from './types';
import { inset, venueText } from './ui';

/** Gray card with the venue name, address and a drawing of its map (the Figma photo slot). */
export function StadiumCard({ venue, onPress }: { venue: Venue; onPress: () => void }) {
  const t = useT('venue');
  const rtl = useLayoutRtl();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${venue.name}, ${venue.address}`}
      accessibilityHint={t('choose.cardHint')}
      style={({ pressed }) => [styles.stadium, pressed ? styles.stadiumPressed : Shadow.card]}>
      <Text style={venueText.label}>{venue.name}</Text>
      <Text style={venueText.caption}>{venue.address}</Text>
      <View style={styles.tile}>
        <VenueDrawing shape={venue.shape} width={170} height={130} />
        <Text style={[styles.tileTag, inset('start', 10, rtl)]}>{eventsLabel(venue, t)}</Text>
      </View>
    </Pressable>
  );
}

/** White row: category icon, name, distance and wait, chevron (pointing left in RTL). */
export function FacilityRow({ facility, onPress }: { facility: Facility; onPress: () => void }) {
  const t = useT('venue');
  const rtl = useLayoutRtl();
  const meta = facilityMeta(facility, t);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t(facility.accessible ? 'row.labelAccessible' : 'row.label', { name: facility.name, meta })}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.rowIcon}>
        <FacilityIcon category={facility.category} size={30} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>{facility.name}</Text>
        <Text style={venueText.caption} numberOfLines={1}>{meta}</Text>
      </View>
      {facility.accessible ? <FigmaIcon name="wheelchair-6dc801" size={22} color={Colors.primary} /> : null}
      <View style={rtl && styles.flip}>
        <FigmaIcon name="group-2-af556f" size={32} color={Colors.ink} />
      </View>
    </Pressable>
  );
}

/** Gray report preview: title, first lines, "see more →". */
export function ReportCard({ report, onPress, fresh }: { report: FacilityReport; onPress: () => void; fresh?: boolean }) {
  const t = useT('venue');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('card.label', { title: report.title, author: report.authorName })}
      accessibilityHint={t('card.hint')}
      style={({ pressed }) => [styles.report, fresh && styles.reportFresh, pressed && styles.reportPressed]}>
      <View style={styles.reportTop}>
        <Text style={[venueText.label, styles.flex]} numberOfLines={1}>{report.title}</Text>
        {fresh ? <Text style={styles.newBadge}>{t('card.new')}</Text> : null}
      </View>
      <Text style={venueText.caption} numberOfLines={2}>{report.body || t('card.by', { author: report.authorName })}</Text>
      <Text style={styles.seeMore}>{t('card.seeMore')}</Text>
    </Pressable>
  );
}

/** "Report Submitted" toast with an action and a close button. */
export function Notification({ title, body, actionLabel, onAction, onClose }: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
  onClose: () => void;
}) {
  const tc = useT('common');
  return (
    <View style={styles.toast} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <View style={styles.toastHead}>
        <Text style={[venueText.title, styles.flex]} accessibilityRole="header">{title}</Text>
        <Pressable onPress={onClose} style={styles.toastClose} accessibilityRole="button" accessibilityLabel={tc('actions.close')}>
          <FigmaIcon name="icon-button-c1cfb2" size={36} color={Colors.ink} />
        </Pressable>
      </View>
      <Text style={styles.toastBody}>{body}</Text>
      <Pressable onPress={onAction} accessibilityRole="button" style={({ pressed }) => [styles.toastButton, pressed && styles.pressed]}>
        <Text style={styles.toastButtonText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },

  stadium: { backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, padding: 15, gap: 5 },
  stadiumPressed: { backgroundColor: Colors.border },
  tile: {
    marginTop: 4,
    height: 132,
    borderRadius: Radius.md,
    backgroundColor: MAP_BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tileTag: {
    position: 'absolute',
    bottom: 10,
    fontFamily: Fonts.textSemiBold,
    fontSize: 13,
    color: Colors.ink,
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 60,
    paddingStart: Spacing.lg,
    paddingEnd: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceAlt,
    backgroundColor: Colors.surface,
    ...Shadow.card,
  },
  rowPressed: { backgroundColor: Colors.surfaceAlt },
  rowIcon: { width: 32, alignItems: 'center' },
  rowText: { flex: 1, gap: 2 },
  flip: { transform: [{ scaleX: -1 }] },
  rowTitle: { fontFamily: Fonts.display, fontSize: 20, lineHeight: 25, color: Colors.text },

  report: { backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 10, gap: 4, ...Shadow.card },
  reportFresh: { borderWidth: 2, borderColor: Colors.primary },
  reportPressed: { backgroundColor: Colors.border },
  reportTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  newBadge: { fontFamily: Fonts.textBold, fontSize: 13, color: Colors.onPrimary, backgroundColor: Colors.primary, paddingHorizontal: 8, paddingVertical: 1, borderRadius: 6, overflow: 'hidden' },
  seeMore: { fontFamily: Fonts.text, fontSize: 13, lineHeight: 17, color: Colors.text, marginTop: 12 },

  toast: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.textFaint,
    padding: Spacing.lg,
    gap: 6,
    ...Shadow.float,
  },
  toastHead: { flexDirection: 'row', alignItems: 'center' },
  toastClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginEnd: -10, marginTop: -8 },
  toastBody: { fontFamily: Fonts.display, fontSize: 15, lineHeight: 20, color: Colors.text },
  toastButton: { alignSelf: 'flex-start', marginTop: 10, minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.lg, borderRadius: Radius.sm, backgroundColor: Colors.ink },
  toastButtonText: { fontFamily: Fonts.text, fontSize: 15, color: Colors.onPrimary },
});
