/** Sheet content: "Add report" for a facility. Title and topic required; errors show inline. */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { ChipGroup } from '@/components/chip-group';
import { MediaActions } from '@/components/media-actions';
import { TextField } from '@/components/text-field';
import { Colors, Spacing, Type } from '@/constants/theme';
import { useProfile } from '@/features/profile/profile-context';
import { useDictation } from '@/features/voice/use-dictation';
import { useT, useUiLanguage } from '@/i18n';
import { goBack } from '@/lib/navigation';

import {
  emptyReportDraft,
  REPORT_TITLE_MAX,
  reportTopicOptions,
  ReportValidationError,
  submitReport,
  validateReport,
  type ReportDraft,
  type ReportErrors,
} from './reports';
import { facilityName } from './labels';
import { takesReports } from './sponsors';
import { SheetScroll, useVenueScreen } from './venue-map-screen';
import { BackArrow, InlineNote, venueText } from './ui';

export function ReportForm() {
  const t = useT('venue');
  const { language } = useUiLanguage();
  const { venue, facilities, setSnap } = useVenueScreen();
  const { profile } = useProfile();
  const { facilityId } = useLocalSearchParams<{ facilityId: string }>();
  // A sponsored stand takes no reports: its link reads as not found.
  const facility = facilities.find(f => f.id === facilityId && takesReports(f));
  const [draft, setDraft] = useState<ReportDraft>(emptyReportDraft);
  const [errors, setErrors] = useState<ReportErrors>({});
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [soon, setSoon] = useState<string | null>(null);
  const tc = useT('common');
  // Tap to dictate into the description (after what's typed); tap again to stop.
  const dictation = useDictation({ onCommit: body => update({ body }), onNote: setSoon });

  useEffect(() => { setSnap('up'); }, [setSnap]);

  const facilityHref = { pathname: '/venue/[venueId]/[facilityId]' as const, params: { venueId: venue.id, facilityId } };

  function update(patch: Partial<ReportDraft>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (tried) setErrors(validateReport(next)); // after the first try, errors clear as they're fixed
  }

  async function submit() {
    if (!facility || saving) return;
    let current = draft;
    if (dictation.listening) {
      // Wait (a few seconds at most) for the last dictated words so they're included.
      setSaving(true);
      const body = await dictation.complete();
      setSaving(false);
      if (body != null) current = { ...draft, body };
    }
    setTried(true);
    const found = validateReport(current);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      const saved = await submitReport({ venueId: venue.id, facilityId, authorName: profile?.firstName ?? '', language, draft: current });
      router.dismissTo({ ...facilityHref, params: { ...facilityHref.params, submitted: saved.id } });
    } catch (e) {
      if (e instanceof ReportValidationError) setErrors(e.errors);
      else setErrors({ body: t('form.sendFailed') });
    } finally {
      setSaving(false);
    }
  }

  // A stale or hand-typed link (/venue/sofi/nope/reports/new, or a sponsored stand's): nothing to report on.
  if (!facility) {
    return (
      <SheetScroll contentContainerStyle={styles.content}>
        <BackArrow onPress={() => goBack({ pathname: '/venue/[venueId]', params: { venueId: venue.id } })} label={t('back.facilities')} />
        <Text style={venueText.title} accessibilityRole="header">{t('facility.notFound')}</Text>
      </SheetScroll>
    );
  }

  return (
    <SheetScroll contentContainerStyle={styles.content}>
      <BackArrow onPress={() => goBack(facilityHref)} label={t('back.facility')} />
      <View style={styles.heading}>
        <Text style={venueText.title} accessibilityRole="header">{t('form.title')}</Text>
        <Text style={venueText.caption}>{t('form.subtitleAt', { facility: facilityName(facility, t) })}</Text>
      </View>

      <TextField
        label={t('form.titleLabel')}
        placeholder={t('form.titlePlaceholder')}
        value={draft.title}
        onChangeText={title => update({ title })}
        maxLength={REPORT_TITLE_MAX + 20}
        error={errors.title}
        returnKeyType="next"
      />
      <TextField
        label={t('form.bodyLabel')}
        placeholder={t('form.bodyPlaceholder')}
        value={dictation.liveText ?? draft.body}
        onChangeText={body => { update({ body }); dictation.edit(body); }}
        multiline
        error={errors.body}
        hint={t('form.bodyHint')}
      />

      <MediaActions
        onAddPicture={() => setSoon(t('form.pictureSoon'))}
        onSpeak={() => dictation.toggle(draft.body)}
        speakLabel={tc('media.tapToSpeak')}
        listening={dictation.listening}
      />
      {soon ? <InlineNote>{soon}</InlineNote> : null}

      <View style={styles.topic}>
        <Text style={Type.label}>{t('form.topic')}</Text>
        <ChipGroup options={reportTopicOptions(t)} value={draft.topic} onChange={topic => update({ topic })} accessibilityLabel={t('form.topic')} />
        {errors.topic ? <Text style={styles.error} accessibilityLiveRegion="polite">{errors.topic}</Text> : null}
      </View>

      <Button label={t('form.submit')} size="lg" onPress={submit} loading={saving} style={styles.submit} />
    </SheetScroll>
  );
}

const styles = StyleSheet.create({
  content: { gap: 20 },
  heading: { gap: 8, marginTop: Spacing.sm },
  topic: { gap: 10 },
  error: { ...Type.caption, color: Colors.danger },
  submit: { marginTop: Spacing.xs },
});
