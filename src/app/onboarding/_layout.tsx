import { Redirect, Stack } from 'expo-router';

import { LoadingScreen } from '@/components/loading-screen';
import { useProfile } from '@/features/profile/profile-context';
import { SetupDraftProvider } from '@/features/profile/setup-draft';
import { homeFor } from '@/features/profile/types';

export default function OnboardingLayout() {
  const { status, profile } = useProfile();
  if (status === 'loading') return <LoadingScreen />;
  // Signed out (or session ended mid-setup) / load error: let the entry gate decide.
  if (status !== 'ready') return <Redirect href="/" />;
  // Already set up: re-running onboarding could switch roles and wipe fields, so go home.
  // (This also handles the redirect right after the last step saves.)
  if (profile) return <Redirect href={homeFor(profile)} />;
  return (
    <SetupDraftProvider>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
    </SetupDraftProvider>
  );
}
