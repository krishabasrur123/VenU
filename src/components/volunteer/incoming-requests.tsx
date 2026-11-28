/**
 * "Incoming requests" on a volunteer's Volunteer tab. With live matching (Supabase): open requests
 * nearby as they come in, each with Accept, which opens the chat with that visitor. Until LA28
 * verifies the volunteer, Accept is off and a "Waiting for verification" note says why. Without live
 * matching (local mode): example requests and a note that matching isn't live yet.
 */
import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Colors, Fonts, Radius, Shadow, Spacing, Type } from '@/constants/theme';
import { useProfile } from '@/features/profile/profile-context';
import { isolate } from '@/features/profile/options';
import { uiLanguageName } from '@/features/profile/summary';
import { useVolunteerDesk, volunteerDesk } from '@/features/volunteer/desk-store';
import { formatDistance } from '@/features/volunteer/format';
import { mockIncoming } from '@/features/volunteer/mock';
import type { IncomingRequest } from '@/features/volunteer/types';
import { languageOf, useT } from '@/i18n';
import { formatNumber } from '@/i18n/format';

import { HelpIcon } from './help-icon';
import { Hint, useHint } from './hint';
import { MeetPlaceText } from './meet-place';
import { DeskBanner } from './note-banner';
import { RequestNote } from './request-note';

/** `verified`: from the volunteer's profile; false keeps Accept off (the server refuses it too). */
export function IncomingRequests({ verified = true }: { verified?: boolean }) {
  return volunteerDesk.live ? <LiveRequests verified={verified} /> : <ExampleRequests />;
}

function Titles() {
  const t = useT('volunteer');
  return (
    <View style={styles.titles}>
      <Text style={styles.title} accessibilityRole="header">{t('incoming.title')}</Text>
      <Text style={styles.subtitle}>{t('incoming.subtitle')}</Text>
    </View>
  );
}

/** Open requests from the backend, kept up to date while on screen. */
function LiveRequests({ verified }: { verified: boolean }) {
  const t = useT('volunteer');
  const { recheck } = useProfile();
  const { open, accepting, assignment, notice } = useVolunteerDesk();
  useEffect(() => volunteerDesk.watchOpen(), []);

  async function accept(id: string) {
    await volunteerDesk.accept(id);
    // Refused as unverified (LA28 took it back since this screen loaded): show the note.
    if (volunteerDesk.getState().notice?.key === 'notVerified') void recheck().catch(() => {});
    // The chat it got, or (already helping someone, from another device) the one it already had.
    const current = volunteerDesk.getState().assignment?.id;
    if (current) router.push({ pathname: '/chat/[id]', params: { id: current } });
  }

  return (
    <View style={styles.page}>
      <Titles />
      {verified ? null : (
        <View style={styles.preview}>
          <Text style={styles.waitTitle}>{t('incoming.waitTitle')}</Text>
          <Text style={styles.previewText}>{t('incoming.waitBody')}</Text>
        </View>
      )}
      {notice?.tone === 'error' ? <DeskBanner notice={notice} /> : null}
      {open.length === 0 ? <Text style={styles.empty}>{t('incoming.empty')}</Text> : null}
      {open.map(r => (
        <RequestCard key={r.id} request={r}>
          <Button
            label={t('incoming.accept')}
            variant="outline"
            loading={accepting === r.id}
            // One request at a time: finish (or end) the current chat first. Unverified: not yet.
            disabled={!verified || !!assignment || (accepting !== null && accepting !== r.id)}
            onPress={() => void accept(r.id)}
          />
        </RequestCard>
      ))}
    </View>
  );
}

/** Local mode: examples, and Accept only explains that matching isn't live. */
function ExampleRequests() {
  const { hint, show } = useHint();
  const t = useT('volunteer');
  return (
    <View style={styles.page}>
      <Titles />
      <View style={styles.preview}>
        <Text style={styles.previewText}>{t('incoming.preview')}</Text>
      </View>
      <Hint text={hint} />
      {mockIncoming().map(r => (
        <RequestCard key={r.id} request={r}>
          <Button label={t('incoming.accept')} variant="outline" onPress={() => show(t('incoming.acceptSoon'))} />
        </RequestCard>
      ))}
    </View>
  );
}

function RequestCard({ request: r, children }: { request: IncomingRequest; children: React.ReactNode }) {
  const t = useT('volunteer');
  const tp = useT('profile');
  const help = t(`helpTypes.${r.helpType}`);
  const lng = languageOf(t);
  const minutes = formatNumber(r.minutesAgo, undefined, lng);
  // In the UI language ("Spanish", not "Español"), as in "Fluent languages"; isolated so an RTL
  // name doesn't reorder the line.
  const language = isolate(uiLanguageName(r.language, tp));
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.iconTile}>
          <HelpIcon type={r.helpType} size={28} color={Colors.primary} />
        </View>
        <View style={styles.text}>
          <Text style={Type.bodyStrong}>{t('incoming.who', { help, name: r.visitorName })}</Text>
          <MeetPlaceText point={r.location} style={styles.where} />
          <Text style={styles.meta}>
            {r.distanceFeet != null
              ? t('incoming.meta', { distance: formatDistance(r.distanceFeet, lng), minutes, language })
              : t('incoming.metaLive', { minutes, language })}
          </Text>
          {/* In the volunteer's language, so they can read it before accepting. */}
          {r.note ? <RequestNote requestId={r.id} note={r.note} lang={r.language} style={styles.note} /> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: Spacing.lg },
  titles: { gap: 5, paddingTop: 18, marginBottom: Spacing.sm },
  title: { ...Type.title, fontSize: 26, lineHeight: 32 },
  subtitle: { fontFamily: Fonts.text, fontSize: 14, lineHeight: 18, color: Colors.text },
  preview: { gap: 2, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt },
  waitTitle: { ...Type.bodyStrong },
  previewText: { ...Type.caption, color: Colors.text },
  empty: { ...Type.caption, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt },
  card: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceAlt,
    backgroundColor: Colors.surface,
    ...Shadow.card,
  },
  top: { flexDirection: 'row', gap: Spacing.md },
  iconTile: { width: 48, height: 48, borderRadius: Radius.md, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  where: { ...Type.caption, color: Colors.text },
  meta: { ...Type.caption },
  note: { ...Type.caption, color: Colors.text, marginTop: 2 },
});
