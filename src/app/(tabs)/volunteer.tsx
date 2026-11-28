import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PageGradient } from '@/components/page-gradient';
import { NAV_BAR_CLEARANCE } from '@/components/tab-bar';
import { FeedbackView } from '@/components/volunteer/feedback-view';
import { MatchView } from '@/components/volunteer/match-view';
import { NotFoundView } from '@/components/volunteer/not-found-view';
import { RequestForm } from '@/components/volunteer/request-form';
import { SearchingView } from '@/components/volunteer/searching-view';
import { VolunteerHome } from '@/components/volunteer/volunteer-home';
import { Colors, Spacing } from '@/constants/theme';
import { useProfile } from '@/features/profile/profile-context';
import { useVolunteerRequest, useVolunteerRestored } from '@/features/volunteer/request-store';

/**
 * The Volunteer tab follows the visitor's request: form → searching → "Volunteer found" (or
 * "No volunteer is free right now") → feedback. One route, so switching tabs and coming back
 * lands on the current step. A volunteer sees their home instead (status, what they can help
 * with, nearby requests).
 */
export default function VolunteerScreen() {
  const { profile } = useProfile();
  const state = useVolunteerRequest();
  const restored = useVolunteerRestored();
  // The tab bar floats above the home indicator, so the last button must clear both.
  const { bottom } = useSafeAreaInsets();
  // The tabs layout only renders tabs for a signed-in user with a profile. Until a saved request
  // has been read back (a moment after start), show nothing rather than flash the empty form.
  if (!profile || !restored) return null;

  const { status, request, match } = state;
  const isVolunteer = profile.role === 'volunteer';
  let body: React.ReactNode;
  // Figma 492:8829 puts Find a Volunteer (only) on the cream-to-blue page gradient.
  let onForm = false;
  if (isVolunteer) body = <VolunteerHome profile={profile} />;
  else if (status === 'searching' && request) body = <SearchingView request={request} notice={state.notice} />;
  else if (status === 'notFound' && request) body = <NotFoundView request={request} />;
  else if (status === 'matched' && request && match) body = <MatchView request={request} match={match} unread={state.unread} />;
  else if (status === 'done' && match) body = <FeedbackView match={match} notice={state.notice} />;
  else {
    body = <RequestForm visitorName={profile.firstName} defaultLanguage={profile.mainLanguage || 'en'} notice={state.notice} draft={state.draft} />;
    onForm = true;
  }
  const bleed = !isVolunteer && status === 'matched'; // the map runs edge to edge

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {onForm ? <PageGradient /> : null}
      <ScrollView
        key={isVolunteer ? 'volunteer' : status} // each step starts at the top
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: NAV_BAR_CLEARANCE + bottom }, bleed && styles.bleed]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {body}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.gutter, paddingTop: Spacing.sm },
  bleed: { paddingHorizontal: 0 },
});
