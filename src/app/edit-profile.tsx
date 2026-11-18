import { Redirect, usePreventRemove } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { StepHeader } from '@/components/form-section';
import { BackLink } from '@/components/top-bar';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { useProfile } from '@/features/profile/profile-context';
import { ProfileForm } from '@/features/profile/profile-form';
import { draftFromProfile } from '@/features/profile/types';
import { useT } from '@/i18n';
import { goBack } from '@/lib/navigation';

export default function EditProfileScreen() {
  const { status, profile, avatarUrl, save } = useProfile();
  const t = useT('profile');
  const [dirty, setDirty] = useState(false);
  const [askDiscard, setAskDiscard] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // One object per saved profile, so the form's "changed?" check compares against the same draft.
  const initial = useMemo(() => (profile ? draftFromProfile(profile) : null), [profile]);

  // Unsaved edits (name typed, a chip changed, a photo picked): any way of leaving asks first, the
  // on-screen Back, Android's back button, iOS's swipe and web's browser Back alike. Signed out
  // (no profile) never asks: that leaves through the redirect below.
  const resume = useRef<(() => void) | null>(null);
  const allowLeaving = usePreventRemove(dirty && !leaving && !!profile, ({ repeat }) => {
    resume.current = repeat;
    setAskDiscard(true);
  });
  /** Stop asking and leave: the way the user tried to (e.g. browser Back), or back to Profile. */
  function leave() {
    setLeaving(true);
    allowLeaving();
    const go = resume.current;
    resume.current = null;
    if (go) go();
    else goBack('/profile');
  }

  if (status === 'loading') return null; // e.g. a web reload straight onto /edit-profile
  if (!profile || !initial) return <Redirect href="/" />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <BackLink label={t('tab.title')} fallback="/profile" />
      {askDiscard ? (
        <View style={styles.confirm} accessibilityLiveRegion="polite">
          <Text style={styles.confirmText}>{t('edit.discardTitle')}</Text>
          <View style={styles.confirmButtons}>
            <Button label={t('edit.keepEditing')} variant="neutral" onPress={() => { resume.current = null; setAskDiscard(false); }} style={styles.flex} />
            <Button label={t('edit.discard')} variant="danger" onPress={leave} style={styles.flex} />
          </View>
        </View>
      ) : null}
      <ProfileForm
        initial={initial}
        savedAvatarUrl={avatarUrl}
        submitLabel={t('edit.submit')}
        onDirtyChange={setDirty}
        onSubmit={async (draft, avatar) => {
          // Saving never changes the app language (the store leaves it as stored; the pills own it).
          await save(draft, avatar);
          leave(); // saved: nothing to ask about
        }}
        header={<StepHeader title={t('edit.title')} subtitle={profile.role === 'volunteer' ? t('edit.subtitleVolunteer') : t('edit.subtitle')} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  confirm: { gap: Spacing.md, marginHorizontal: Spacing.gutter, padding: Spacing.lg, borderRadius: Radius.md, backgroundColor: Colors.dangerSoft },
  confirmText: { ...Type.body },
  confirmButtons: { flexDirection: 'row', gap: Spacing.md },
});
