import { Redirect } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StepHeader } from '@/components/form-section';
import { BackLink } from '@/components/top-bar';
import { Colors } from '@/constants/theme';
import { useProfile } from '@/features/profile/profile-context';
import { ProfileForm } from '@/features/profile/profile-form';
import { draftFromProfile } from '@/features/profile/types';
import { useT } from '@/i18n';
import { goBack } from '@/lib/navigation';

export default function EditProfileScreen() {
  const { status, profile, avatarUrl, save } = useProfile();
  const t = useT('profile');
  if (status === 'loading') return null; // e.g. a web reload straight onto /edit-profile
  if (!profile) return <Redirect href="/" />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <BackLink label={t('tab.title')} fallback="/profile" />
      <ProfileForm
        initial={draftFromProfile(profile)}
        savedAvatarUrl={avatarUrl}
        submitLabel={t('edit.submit')}
        onSubmit={async (draft, avatar) => {
          await save(draft, avatar);
          goBack('/profile');
        }}
        header={<StepHeader title={t('edit.title')} subtitle={t('edit.subtitle')} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
});
