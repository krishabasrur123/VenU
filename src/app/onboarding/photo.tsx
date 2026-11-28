import { Redirect, router } from 'expo-router';
import { useRef, useState } from 'react';
import { Trans } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AvatarPicker } from '@/components/avatar-picker';
import { TextField } from '@/components/text-field';
import { BackLink } from '@/components/top-bar';
import { AppLanguagePill } from '@/components/volunteer/app-language-pill';
import { Colors, Spacing, Type } from '@/constants/theme';
import { Checkbox } from '@/features/auth/auth-ui';
import { OnboardingScreen, PrimaryAction } from '@/features/auth/onboarding-screen';
import { clearPendingName, readPendingSetupAfterWrites } from '@/features/auth/pending-setup';
import { useProfile } from '@/features/profile/profile-context';
import { stepErrors, useSetupDraft } from '@/features/profile/setup-draft';
import { clearSavedDraft } from '@/features/profile/setup-draft-storage';
import { FIRST_NAME_MAX } from '@/features/profile/validate';
import { useT, useUiLanguage } from '@/i18n';
import { pickFor, setupAppLanguage } from '@/i18n/languages';
import { forgetLanguagePick } from '@/i18n/pending-language';
import { ERROR_CODES, errorText } from '@/lib/errors';

/**
 * Last setup step, "Choose a profile picture" (Figma 482:32439), then save. The photo is
 * optional; the first name (pre-filled from Create Account) and the privacy consent aren't, and
 * neither has a Figma frame of its own, so they're asked here before "Finish Setup".
 */
export default function PhotoStep() {
  const { save, userId } = useProfile();
  const { ready, draft, avatar, update, setAvatar } = useSetupDraft();
  const { language: onScreen } = useUiLanguage();
  const t = useT('onboarding');
  const tp = useT('profile');
  const tc = useT('common');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);
  // A double tap (or Enter plus a tap on web) mustn't start two saves and two uploads.
  const inFlight = useRef(false);

  if (!ready) return null; // reading the answers saved before a reload
  if (!draft) return <Redirect href="/onboarding/languages" />;
  const errors = submitted ? stepErrors('photo', draft) : {};
  const shown = avatar === 'remove' ? null : avatar ? avatar.uri : null;

  async function finish() {
    if (inFlight.current || !draft) return;
    setSubmitted(true);
    setSaveError(null);
    if (Object.keys(stepErrors('photo', draft)).length) return;
    inFlight.current = true;
    setSaving(true);
    try {
      // Read now, not at the first step: the corner pill may have changed the language since.
      const pending = await readPendingSetupAfterWrites();
      const pick = pickFor({ language: pending.language, picked: pending.languagePicked === true, pickedBy: pending.languagePickedBy }, userId);
      // A pill pick stays the app language (whatever the primary language); without one, a
      // translated primary language becomes it, e.g. picked العربية + primary हिन्दी → Arabic.
      const appLanguage = setupAppLanguage(draft.mainLanguage, pick, onScreen);
      await save({ ...draft, appLanguage }, avatar);
      await forgetLanguagePick(); // saved with the profile; don't apply it to the account again
      await clearPendingName();
      await clearSavedDraft();
      // No navigation: once the profile exists, the onboarding layout redirects to the home tab.
    } catch (e) {
      // The picked photo can't be read any more (e.g. after a web reload): drop it; the rest can be saved again.
      if ((e as { code?: unknown } | null)?.code === ERROR_CODES.photoUnreadable) setAvatar(null);
      setSaveError(e ?? new Error('save failed'));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  const back = draft.role === 'visitor' ? '/onboarding/preferences' : '/onboarding/volunteer';
  return (
    <OnboardingScreen
      pill={<AppLanguagePill look="onboarding" />}
      back={<BackLink fallback={back} />}
      title={t('steps.photoTitle')}
      subtitle={draft.role === 'visitor' ? t('steps.photoSubtitle') : t('steps.photoSubtitleVolunteer')}
      actions={<PrimaryAction label={t('steps.finish')} onPress={() => void finish()} loading={saving} />}>
      <View style={styles.body}>
        <AvatarPicker layout="stacked" role={draft.role} name={draft.firstName} uri={shown} onPick={setAvatar} onRemove={() => setAvatar('remove')} />
        <TextField
          label={tp('form.firstName')}
          value={draft.firstName}
          onChangeText={v => update({ firstName: v })}
          placeholder={draft.role === 'visitor' ? tp('form.firstNamePlaceholderVisitor') : tp('form.firstNamePlaceholderVolunteer')}
          maxLength={FIRST_NAME_MAX}
          autoComplete="given-name"
          textContentType="givenName"
          error={errors.firstName}
          hint={tp('form.firstNameHint')}
        />
        <Checkbox
          checked={draft.privacyAccepted}
          onToggle={() => update({ privacyAccepted: !draft.privacyAccepted })}
          error={errors.privacyAccepted}
          accessibilityLabel={tp('form.privacyAgreeLabel')}>
          <Text style={Type.body}>
            <Trans
              t={tp}
              i18nKey="form.privacyAgree"
              components={{ a: <Text style={styles.link} onPress={() => router.push('/privacy')} accessibilityRole="link" /> }}
            />
          </Text>
        </Checkbox>
        {saveError ? <Text style={styles.error} accessibilityLiveRegion="polite">{errorText(saveError, tc)}</Text> : null}
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.xl, marginTop: Spacing.lg },
  link: { color: Colors.primary, textDecorationLine: 'underline' },
  error: { ...Type.caption, color: Colors.danger },
});
