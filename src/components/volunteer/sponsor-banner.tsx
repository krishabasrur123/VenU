/**
 * The one ad slot outside the Venue tab: a small "Sponsored" card at the end of the waiting screen
 * (SearchingView), for the venue's featured stand (features/venue/sponsors.ts).
 * - Shows only while a visitor's request is searching (waitingBannerFor), so it can't leak onto the
 *   match, chat, feedback or volunteer screens even if it were placed there.
 * - Sits in the page flow below Cancel, never over the request, the notice or Cancel.
 * - Tapping opens the stand on the Venue tab; the request keeps searching, and the Volunteer tab
 *   (or Back) returns to it. × hides it for the rest of this request.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FigmaIcon } from '@/components/icons/figma-icon';
import { Colors, Face, Fonts, Radius, Spacing } from '@/constants/theme';
import { useProfile } from '@/features/profile/profile-context';
import { facilityName, facilityOffer, walkLabel } from '@/features/venue/labels';
import { SPONSOR_ACCENT, SPONSOR_SOFT, SponsoredIcon, SponsoredTag } from '@/features/venue/sponsor-ui';
import { waitingBannerFor } from '@/features/venue/sponsors';
import { useVolunteerRequest } from '@/features/volunteer/request-store';
import { useT } from '@/i18n';

// Requests whose banner was closed, for this visit: leaving for the stand and coming back keeps it closed.
const dismissed = new Set<string>();

export function SponsorBanner() {
  const t = useT('venue');
  const { profile } = useProfile();
  const { status, request } = useVolunteerRequest();
  const [closed, setClosed] = useState(() => (request ? dismissed.has(request.id) : false));
  const banner = waitingBannerFor({ role: profile?.role, status, location: request?.location });
  if (!banner || !request || closed) return null;

  const { stand } = banner;
  const name = facilityName(stand, t);
  const offer = facilityOffer(stand, t);
  const walk = walkLabel(banner.walk, t); // worded as on the list, the pin card and the stand's page
  const close = () => {
    dismissed.add(request.id);
    setClosed(true);
  };

  return (
    <View style={styles.box}>
      <Pressable
        onPress={() => router.push({ pathname: '/venue/[venueId]/[facilityId]', params: { venueId: stand.venueId, facilityId: stand.id } })}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t('sponsor.banner', { name, walk, offer })}
        accessibilityHint={t('sponsor.bannerHint')}>
        <View style={styles.icon}>
          <SponsoredIcon size={24} background={SPONSOR_SOFT} />
        </View>
        <View style={styles.text}>
          <SponsoredTag />
          <Text style={styles.name} numberOfLines={2}>{`${name} · ${walk}`}</Text>
          <Text style={styles.offer} numberOfLines={2}>{offer}</Text>
        </View>
      </Pressable>
      <Pressable onPress={close} hitSlop={4} style={styles.close} accessibilityRole="button" accessibilityLabel={t('sponsor.hide')}>
        <FigmaIcon name="icon-button-c1cfb2" size={24} color={Colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: Radius.md, borderWidth: 1.5, borderColor: SPONSOR_SOFT, backgroundColor: Colors.surface },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, paddingEnd: 0, borderRadius: Radius.md },
  pressed: { opacity: 0.7 },
  icon: { width: 40, height: 40, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: SPONSOR_SOFT },
  text: { flex: 1, gap: 2 },
  name: { ...Face.displayMedium, fontSize: 14, lineHeight: 19, color: Colors.text },
  offer: { fontFamily: Fonts.text, fontSize: 13, lineHeight: 17, color: SPONSOR_ACCENT },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
