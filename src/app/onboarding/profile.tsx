import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StepHeader } from '@/components/form-section';
import { BackLink } from '@/components/top-bar';
import { Colors } from '@/constants/theme';
import { clearPendingName, readPendingSetup, type PendingSetup } from '@/features/auth/pending-setup';
import { useProfile } from '@/features/profile/profile-context';
import { ProfileForm } from '@/features/profile/profile-form';
import { emptyDraft, type Role } from '@/features/profile/types';
import { useT } from '@/i18n';

/** Figma onboarding__profile-setup ("Set up your profile"); volunteers get their own questions. */
export default function ProfileStep() {
  const params = useLocalSearchParams<{ role?: string }>();
  const { save } = useProfile();
  const t = useT('onboarding');
  // The landing page's language and Create Account's name; null until read.
  const [pending, setPending] = useState<PendingSetup | null>(null);

  useEffect(() => {
    let live = true;
    readPendingSetup().then(p => live && setPending(p));
    return () => { live = false; };
  }, []);

  const role: Role | null = params.role === 'visitor' || params.role === 'volunteer' ? params.role : null;
  if (!role) return <Redirect href="/onboarding/role" />;
  if (!pending) return null; // one storage read; the form needs its starting values up front

  const visitor = role === 'visitor';
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <BackLink fallback="/onboarding/role" />
      <ProfileForm
        initial={{ ...emptyDraft(role, pending.language ?? 'en'), firstName: pending.firstName ?? '' }}
        savedAvatarUrl={null}
        submitLabel={t('setup.submit')}
        // No navigation here: once the profile exists, the onboarding layout redirects to the home tab.
        onSubmit={async (draft, avatar) => {
          await save(draft, avatar);
          await clearPendingName();
        }}
        header={
          <StepHeader
            title={visitor ? t('setup.visitorTitle') : t('setup.volunteerTitle')}
            subtitle={visitor ? t('setup.visitorSubtitle') : t('setup.volunteerSubtitle')}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
});
