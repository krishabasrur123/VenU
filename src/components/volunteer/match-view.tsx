/** "Volunteer found" (Figma 214:25058): who's coming, where they are, message, done or cancel. */
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { FigmaIcon, type FigmaIconName } from '@/components/icons/figma-icon';
import { Colors, Face, Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { formatDistance } from '@/features/volunteer/format';
import { meetSpotName, meetVenueName } from '@/features/volunteer/meet-point';
import { volunteerRequests } from '@/features/volunteer/request-store';
import type { HelpRequest, Match } from '@/features/volunteer/types';
import { languageOf, useT } from '@/i18n';
import { formatNumber } from '@/i18n/format';

import { MeetMap } from './meet-map';
import { MessageButton } from './message-button';
import { useStartAligned } from './start-aligned';

export function MatchView({ request, match, unread }: { request: HelpRequest; match: Match; unread: number }) {
  // Done and Cancel both end the chat, so each asks once before it does.
  const [confirming, setConfirming] = useState<'done' | 'cancel' | null>(null);
  const t = useT('volunteer');
  const tv = useT('venue');
  const v = match.volunteer;
  const onTheWay = {
    his: t('match.onTheWay.his', { name: v.firstName }),
    her: t('match.onTheWay.her', { name: v.firstName }),
    their: t('match.onTheWay.their', { name: v.firstName }),
  }[v.possessive];
  const openChat = () => router.push({ pathname: '/chat/[id]', params: { id: request.id } });
  // Live matching knows neither (no locations yet): the tiles and the map's distance just don't show.
  const distance = match.distanceFeet != null ? formatDistance(match.distanceFeet, languageOf(t)) : null;
  const eta = match.etaMinutes != null ? formatNumber(match.etaMinutes, undefined, languageOf(t)) : null;
  const startAligned = useStartAligned(); // "Daniel K." on the start edge in Arabic too

  return (
    <View style={styles.page}>
      <View style={[styles.gutter, styles.header]}>
        <Text style={styles.title} accessibilityRole="header">{t('match.title')}</Text>
        <MessageButton unread={unread} onPress={openChat} />
      </View>

      <View style={[styles.gutter]}>
        <View style={styles.status} accessibilityLiveRegion="polite">
          <FigmaIcon name="check-circle" size={40} color={Colors.onPrimary} />
          <View style={styles.statusText}>
            <Text style={styles.statusTitle}>{onTheWay}</Text>
            <Text style={styles.statusSub}>{t('match.stay')}</Text>
          </View>
        </View>
      </View>

      <MeetMap volunteerName={v.name} distanceLabel={distance} place={meetSpotName(request.location, tv) ?? meetVenueName(request.location)} />

      <View style={[styles.gutter, styles.card]}>
        <View style={styles.who}>
          <FigmaIcon name="person" size={24} color={Colors.ink} />
          <View style={styles.whoText}>
            <Text style={[styles.name, startAligned]}>{v.name}</Text>
            <Text style={[styles.role, startAligned]}>{t('role')}</Text>
          </View>
          {v.rating != null ? (
            <View style={styles.rating} accessible accessibilityLabel={t('match.rated', { rating: formatNumber(v.rating, undefined, languageOf(t)) })}>
              <FigmaIcon name="star" size={18} color={Colors.warning} />
              <Text style={styles.ratingText}>{formatNumber(v.rating, { minimumFractionDigits: 1, maximumFractionDigits: 1 }, languageOf(t))}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.tagsBlock}>
          <Text style={styles.tagsLabel}>{t('match.skills')}</Text>
          <View style={styles.tags}>
            {v.tags.map(tag => (
              <View key={tag.label} style={[styles.tag, tag.tone === 'success' ? styles.tagSuccess : styles.tagWarning]}>
                <Text style={[styles.tagText, tag.tone === 'success' && styles.tagTextSuccess]}>{tag.skill ? t(`skills.${tag.skill}`) : tag.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {eta !== null || distance !== null ? (
          <View style={styles.infoRow}>
            {eta !== null ? (
              <InfoTile icon="clock" main={t('match.etaMain', { minutes: eta })} sub={t('match.etaSub')} label={t('match.etaLabel', { minutes: eta })} />
            ) : null}
            {distance !== null ? (
              <InfoTile icon="map-pin" main={distance} sub={t('match.awaySub')} label={t('match.awayLabel', { distance })} />
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={[styles.gutter, styles.actions]}>
        <Button label={t('match.message')} size="lg" onPress={openChat} />
        {confirming === 'done' ? (
          <View style={styles.confirmDone} accessibilityLiveRegion="polite">
            <Text style={styles.confirmText}>{t('match.confirmDone', { name: v.firstName })}</Text>
            <View style={styles.confirmButtons}>
              <Button label={t('match.notYet')} variant="neutral" onPress={() => setConfirming(null)} style={styles.flex} />
              <Button label={t('match.yesDone')} onPress={volunteerRequests.endHelp} style={styles.flex} />
            </View>
          </View>
        ) : (
          <Button label={t('match.done')} variant="outline" onPress={() => setConfirming('done')} accessibilityHint={t('match.doneHint', { name: v.firstName })} />
        )}
        {confirming === 'cancel' ? (
          <View style={styles.confirm} accessibilityLiveRegion="polite">
            <Text style={styles.confirmText}>{t('match.confirmCancel', { name: v.firstName })}</Text>
            <View style={styles.confirmButtons}>
              <Button label={t('match.keep')} variant="neutral" onPress={() => setConfirming(null)} style={styles.flex} />
              <Button label={t('match.yesCancel')} variant="danger" onPress={volunteerRequests.cancel} style={styles.flex} />
            </View>
          </View>
        ) : (
          <Button label={t('cancelRequest')} variant="link" onPress={() => setConfirming('cancel')} style={styles.cancel} />
        )}
      </View>
    </View>
  );
}

function InfoTile({ icon, main, sub, label }: { icon: FigmaIconName; main: string; sub: string; label: string }) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={label}>
      <FigmaIcon name={icon} size={22} color={Colors.textFaint} />
      <View>
        <Text style={styles.tileMain}>{main}</Text>
        <Text style={styles.tileSub}>{sub}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: Spacing.lg },
  gutter: { paddingHorizontal: Spacing.gutter },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Spacing.md },
  title: { ...Type.title, fontSize: 26, lineHeight: 32 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 73,
    paddingHorizontal: Spacing.gutter,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.success,
  },
  statusText: { flex: 1, gap: 4 },
  statusTitle: { ...Face.displayMedium, fontSize: 16, lineHeight: 20, color: Colors.onPrimary },
  statusSub: { fontFamily: Fonts.text, fontSize: 14, lineHeight: 18, color: Colors.onPrimary },
  card: { gap: Spacing.lg, paddingTop: Spacing.sm },
  who: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingHorizontal: Spacing.sm },
  whoText: { flex: 1, gap: 3 },
  name: { ...Type.bodyStrong },
  role: { fontFamily: Fonts.text, fontSize: 13, lineHeight: 16, color: Colors.text },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingText: { fontFamily: Fonts.text, fontSize: 14, color: Colors.text },
  tagsBlock: { gap: Spacing.sm, paddingHorizontal: Spacing.sm },
  tagsLabel: { fontFamily: Fonts.text, fontSize: 13, color: Colors.text },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tag: { minHeight: 26, paddingHorizontal: 12, borderRadius: Radius.sm, justifyContent: 'center' },
  tagSuccess: { backgroundColor: Colors.success },
  tagWarning: { backgroundColor: Colors.warning },
  tagText: { fontFamily: Fonts.text, fontSize: 13, lineHeight: 16, color: Colors.ink },
  tagTextSuccess: { color: Colors.onPrimary },
  infoRow: { flexDirection: 'row', gap: Spacing.md },
  tile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceAlt,
  },
  tileMain: { fontFamily: Fonts.display, fontSize: 15, lineHeight: 19, color: Colors.ink },
  tileSub: { fontFamily: Fonts.text, fontSize: 13, lineHeight: 16, color: Colors.ink },
  actions: { gap: Spacing.md, marginTop: Spacing.sm },
  cancel: { alignSelf: 'center' },
  confirm: { gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.md, backgroundColor: Colors.dangerSoft },
  confirmDone: { gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.md, backgroundColor: Colors.primarySoft },
  confirmText: { ...Type.body },
  confirmButtons: { flexDirection: 'row', gap: Spacing.md },
});
