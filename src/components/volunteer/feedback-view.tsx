/** "Volunteer feedback report" (Figma 235:26589): stars, what went well, a note, Submit. */
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { ChipGroup } from '@/components/chip-group';
import { TextField } from '@/components/text-field';
import { Colors, Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { FEEDBACK_TAGS, PROBLEM_KINDS } from '@/features/volunteer/mock';
import { volunteerRequests } from '@/features/volunteer/request-store';
import type { FeedbackTag, Match, ProblemKind } from '@/features/volunteer/types';
import { useT } from '@/i18n';
import { friendlyError } from '@/lib/errors';

import { NoteBox } from './note-box';
import { StarRating } from './star-rating';

export function FeedbackView({ match }: { match: Match }) {
  const v = match.volunteer;
  const t = useT('volunteer');
  const tagOptions = useMemo(() => FEEDBACK_TAGS.map(value => ({ value, label: t(`feedback.tags.${value}`) })), [t]);
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<FeedbackTag[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!stars) return setError(t('feedback.pickStar', { name: v.firstName }));
    setBusy(true);
    setError(null);
    try {
      await volunteerRequests.submitFeedback(stars, tags, note);
    } catch (e) {
      setError(t('feedback.sendFailed', { reason: friendlyError(e) }));
      setBusy(false);
    }
  }

  return (
    <View style={styles.page}>
      <View style={styles.skipRow}>
        <Pressable onPress={volunteerRequests.skipFeedback} accessibilityRole="button" accessibilityLabel={t('feedback.skipLabel')} style={styles.skip}>
          <Text style={styles.skipText}>{t('feedback.skip')}</Text>
        </Pressable>
      </View>

      <View style={styles.who}>
        <Avatar name={v.firstName} uri={null} size={56} />
        <Text style={styles.name}>{v.name}</Text>
        <Text style={styles.role}>{t('role')}</Text>
      </View>

      <View style={styles.rate}>
        <Text style={styles.question} accessibilityRole="header">{t('feedback.question')}</Text>
        <StarRating value={stars} onChange={n => { setStars(n); setError(null); }} />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>{t('feedback.wentWell')}</Text>
        {/* Three even columns (Figma's 3 + 3); a free wrap breaks 2 + 3 + 1 on a 390pt phone. */}
        <ChipGroup multiple columns={3} options={tagOptions} value={tags} onChange={setTags} accessibilityLabel={t('feedback.wentWell')} />
      </View>

      <NoteBox value={note} onChangeText={setNote} placeholder={t('feedback.placeholder', { name: v.firstName })} />

      <View style={styles.actions}>
        {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
        <Button label={t('feedback.submit')} size="lg" onPress={submit} loading={busy} />
        <ReportProblem />
      </View>
    </View>
  );
}

/** "Report a problem": a short inline form (kind + what happened), sent to LA28 staff. */
function ReportProblem() {
  const t = useT('volunteer');
  const kindOptions = useMemo(() => PROBLEM_KINDS.map(value => ({ value, label: t(`report.kinds.${value}`) })), [t]);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ProblemKind | null>(null);
  const [note, setNote] = useState('');
  const [state, setState] = useState<'editing' | 'sending' | 'sent'>('editing');
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!kind) return setError(t('report.pickKind'));
    setState('sending');
    setError(null);
    try {
      await volunteerRequests.reportProblem(kind, note);
      setState('sent');
    } catch (e) {
      setError(t('report.sendFailed', { reason: friendlyError(e) }));
      setState('editing');
    }
  }

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" style={styles.reportLink}>
        <Text style={styles.reportLinkText}>{t('report.title')}</Text>
      </Pressable>
    );
  }
  if (state === 'sent') {
    return (
      <View style={styles.report} accessibilityLiveRegion="polite">
        <Text style={styles.reportTitle}>{t('report.sent')}</Text>
        <Text style={Type.body}>{t('report.sentBody')}</Text>
      </View>
    );
  }
  return (
    <View style={styles.report}>
      <Text style={styles.reportTitle} accessibilityRole="header">{t('report.title')}</Text>
      <ChipGroup options={kindOptions} value={kind} onChange={k => { setKind(k); setError(null); }} accessibilityLabel={t('report.kindLabel')} />
      <TextField value={note} onChangeText={setNote} multiline placeholder={t('report.notePlaceholder')} accessibilityLabel={t('report.notePlaceholder')} maxLength={1000} />
      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
      <View style={styles.reportButtons}>
        <Button label={t('report.notNow')} variant="neutral" onPress={() => setOpen(false)} style={styles.flex} />
        <Button label={t('report.send')} variant="danger" onPress={send} loading={state === 'sending'} style={styles.flex} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: Spacing.xl },
  flex: { flex: 1 },
  skipRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: -Spacing.xl },
  skip: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' },
  skipText: { ...Type.bodyStrong, color: Colors.primary },
  who: { alignItems: 'center', gap: 6 },
  name: { ...Type.title, marginTop: Spacing.sm },
  role: { fontFamily: Fonts.text, fontSize: 13, color: Colors.textFaint },
  rate: { alignItems: 'center', gap: Spacing.md, marginTop: Spacing.sm },
  question: { ...Type.title, textAlign: 'center' },
  section: { gap: Spacing.lg },
  label: { ...Type.body },
  actions: { gap: Spacing.md, marginTop: Spacing.md },
  error: { ...Type.caption, color: Colors.danger, textAlign: 'center' },
  reportLink: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.sm },
  reportLinkText: { ...Type.body, color: Colors.danger, textDecorationLine: 'underline' },
  report: { gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.md, backgroundColor: Colors.dangerSoft },
  reportTitle: { ...Type.heading },
  reportButtons: { flexDirection: 'row', gap: Spacing.md },
});
