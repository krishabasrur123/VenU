/**
 * A volunteer's Volunteer tab (Figma "Volunteer Home"): where they are, Free / Busy / Off, what they
 * can help with, then nearby requests while Free, or the request they accepted.
 */
import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { labelFor, TRAININGS } from '@/features/profile/options';
import { useProfile } from '@/features/profile/profile-context';
import { uiLanguageName } from '@/features/profile/summary';
import type { Profile } from '@/features/profile/types';
import { useWhereAmI } from '@/features/venue/current';
import { getVenue } from '@/features/venue/mock';
import { meetSpotLabel, meetVenueName } from '@/features/volunteer/meet-point';
import { useVolunteerDesk, volunteerDesk } from '@/features/volunteer/desk-store';
import { useT } from '@/i18n';

import { ActiveRequest } from './active-request';
import { AppLanguagePill } from './app-language-pill';
import { EmergencyCard } from './emergency-card';
import { IncomingRequests } from './incoming-requests';
import { DeskBanner } from './note-banner';
import { useStartAligned } from './start-aligned';
import { StatusCard } from './status-card';

type HomeProfile = Pick<Profile, 'id' | 'firstName' | 'languages' | 'mainLanguage' | 'trainings' | 'availability' | 'verified'>;

/** While a volunteer waits for verification, the tab re-reads their profile this often (and on app resume). */
export const VERIFIED_RECHECK_MS = 30_000;

export function VolunteerHome({ profile }: { profile: HomeProfile }) {
  const t = useT('volunteer');
  const tv = useT('venue');
  const where = useWhereAmI();
  const venueName = getVenue(where.venueId)?.name ?? '';
  // With no spot chosen the location card below is just the venue: don't name it twice.
  const spotChosen = meetSpotLabel(where, tv, t) !== null;
  const { saveSettings, recheck } = useProfile();
  const status = profile.availability;
  const setStatus = (availability: HomeProfile['availability']) => saveSettings({ availability });
  useVerifiedRecheck(profile.verified, recheck);
  const startAligned = useStartAligned();
  const { assignment, unread, notice } = useVolunteerDesk();

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <AppLanguagePill />
        <View style={styles.titles}>
          <Text style={styles.title} accessibilityRole="header">{t('home.greeting', { name: profile.firstName })}</Text>
          {spotChosen ? <Text style={[styles.subtitle, startAligned]}>{venueName}</Text> : null}
        </View>
      </View>

      {/* How the last chat ended. "Already taken" shows by the list instead, where Accept was tapped. */}
      {notice?.tone === 'success' ? <DeskBanner notice={notice} /> : null}
      {assignment ? <ActiveRequest assignment={assignment} unread={unread} /> : null}

      <LocationCard />
      {/* While helping, the line says so; the stored Free / Busy / Off stays for after. */}
      <StatusCard status={status} onChange={setStatus} helping={assignment?.visitorName ?? null} />
      <HelpWithCard profile={profile} />

      {assignment ? null : status === 'free' ? (
        <IncomingRequests verified={profile.verified} />
      ) : (
        <Text style={styles.paused}>{t('home.paused')}</Text>
      )}

      <EmergencyCard />
    </View>
  );
}

/**
 * LA28 verifies volunteers in the dashboard, so nothing tells the app when it happens: until then,
 * re-read the profile now, every VERIFIED_RECHECK_MS and on returning to the app. Live matching only
 * (local mode has no one to verify anyone).
 */
function useVerifiedRecheck(verified: boolean, recheck: () => Promise<void>) {
  useEffect(() => {
    if (verified || !volunteerDesk.live) return;
    const check = () => void recheck().catch(() => {});
    check();
    const timer = setInterval(check, VERIFIED_RECHECK_MS);
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') check();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [verified, recheck]);
}

/** Solid map pin from the Figma card. */
function Pin() {
  return (
    <Svg width={30} height={30} viewBox="0 0 24 24" aria-hidden>
      <Path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2z" fill={Colors.ink} />
    </Svg>
  );
}

/** The blue card: "Near Entry 4" over the venue, or just the venue. Opens the venue map. */
function LocationCard() {
  const t = useT('volunteer');
  const tv = useT('venue');
  const where = useWhereAmI();
  const { venueId } = where;
  const venueName = meetVenueName(where);
  const near = meetSpotLabel(where, tv, t);
  const startAligned = useStartAligned();

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/venue/[venueId]', params: { venueId } })}
      style={({ pressed }) => [styles.location, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={near ? t('home.locationLabel', { place: near, venue: venueName }) : venueName}
      accessibilityHint={t('home.locationHint')}>
      <Pin />
      <View style={styles.locationText}>
        <Text style={[styles.spot, startAligned]}>{near ?? venueName}</Text>
        {near ? <Text style={[styles.venue, startAligned]}>{venueName}</Text> : null}
      </View>
    </Pressable>
  );
}

/** Fluent languages (main first) and training, as visitors are matched on them. Edit opens the profile form. */
function HelpWithCard({ profile }: { profile: HomeProfile }) {
  const t = useT('volunteer');
  const tc = useT('common');
  const tp = useT('profile');
  const { languages, mainLanguage, trainings } = profile;
  const fluent = [mainLanguage, ...languages.filter(l => l !== mainLanguage)].filter(l => languages.includes(l));

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle} accessibilityRole="header">{t('home.helpTitle')}</Text>
        <Pressable
          onPress={() => router.push('/edit-profile')}
          style={styles.editTarget}
          accessibilityRole="link"
          accessibilityLabel={t('home.editLabel')}>
          <Text style={styles.edit}>{tc('actions.edit')}</Text>
        </Pressable>
      </View>

      <View style={styles.group}>
        <Text style={styles.overline}>{t('home.languages')}</Text>
        <Tags labels={fluent.map(code => uiLanguageName(code, tp))} />
      </View>
      <View style={styles.group}>
        <Text style={styles.overline}>{t('home.training')}</Text>
        {trainings.length ? (
          <Tags labels={trainings.map(skill => labelFor(TRAININGS, skill, tp))} />
        ) : (
          <Text style={Type.caption}>{t('home.noTraining')}</Text>
        )}
      </View>
    </View>
  );
}

/** Same chips as the profile's summary tags. */
function Tags({ labels }: { labels: string[] }) {
  return (
    <View style={styles.tags}>
      {labels.map(label => (
        <Text key={label} style={styles.tag}>{label}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: Spacing.lg },
  header: { gap: Spacing.xs },
  titles: { gap: 2 },
  title: { ...Type.title, fontSize: 26, lineHeight: 32 },
  subtitle: { fontFamily: Fonts.text, fontSize: 14, lineHeight: 18, color: Colors.text },
  pressed: { opacity: 0.8 },

  location: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    minHeight: 62,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  locationText: { flex: 1, gap: 2 },
  spot: { ...Type.bodyStrong },
  venue: { fontFamily: Fonts.text, fontSize: 13, lineHeight: 16, color: Colors.text },

  card: { gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  cardTitle: { ...Type.bodyStrong, flexShrink: 1 },
  editTarget: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', marginVertical: -Spacing.md },
  edit: { ...Type.body, color: Colors.primary, textDecorationLine: 'underline' },
  group: { gap: 6 },
  overline: { ...Type.overline },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    ...Type.caption,
    color: Colors.text,
    backgroundColor: Colors.bg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },

  paused: { ...Type.caption, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt },
});
