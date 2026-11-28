/** Sheet content: one facility report in full ("Gate 2 Ramp Outdated", by Rosa W.); its author can delete it. */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { TranslationNote } from '@/components/translation-note';
import { Colors, Face, Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { uiLanguageName } from '@/features/profile/summary';
import { useT, useUiLanguage } from '@/i18n';
import { formatDate } from '@/i18n/format';
import { friendlyError } from '@/lib/errors';
import { goBack } from '@/lib/navigation';

import { deleteReport, reportAt, reportAuthor, topicLabel, useReport } from './reports';
import { useReportTranslation } from './report-translation';
import { SheetScroll, useVenueScreen } from './venue-map-screen';
import { BackArrow, TagRow, venueText } from './ui';

export function ReportDetail() {
  const t = useT('venue');
  const tp = useT('profile');
  const { language: onScreen } = useUiLanguage();
  const { venue, setSnap } = useVenueScreen();
  const { facilityId, reportId } = useLocalSearchParams<{ facilityId: string; reportId: string }>();
  const stored = useReport(reportId);
  const report = reportAt(stored, venue.id, facilityId);
  // In the reader's language, like chat, with "Show original".
  const tr = useReportTranslation(report);
  const translating = tr.view.kind === 'translated' || tr.view.kind === 'loading' || tr.view.kind === 'failed';

  useEffect(() => { setSnap('up'); }, [setSnap]);

  const back = () => goBack({ pathname: '/venue/[venueId]/[facilityId]', params: { venueId: venue.id, facilityId } });

  return (
    <SheetScroll contentContainerStyle={styles.content}>
      <BackArrow onPress={back} label={t('back.facility')} />
      {report === undefined ? null : report === null ? (
        <Text style={venueText.title}>{t('report.notFound')}</Text>
      ) : (
        <>
          <View style={styles.heading}>
            <Text style={venueText.title} accessibilityRole="header">{tr.title}</Text>
            <Text style={styles.kind}>{t('report.kind')}</Text>
          </View>
          <TagRow tags={[{ label: topicLabel(report.topic, t), tone: report.topic === 'accessibility' ? 'good' : 'note' }]} />
          <View style={styles.author}>
            <Avatar name={reportAuthor(report, t)} uri={null} size={44} />
            <View style={styles.authorText}>
              <Text style={venueText.label}>{reportAuthor(report, t)}</Text>
              <Text style={venueText.caption}>{t('report.submitted', { date: formatDate(report.createdAt) })}</Text>
              {/* Shown as written (no translation here): say which language when it isn't the one on screen. */}
              {!translating && report.language && report.language !== onScreen ? (
                <Text style={venueText.caption}>{t('report.originalLanguage', { language: uiLanguageName(report.language, tp) })}</Text>
              ) : null}
            </View>
          </View>
          {report.body ? <Text style={styles.body}>{tr.body}</Text> : <Text style={styles.noBody}>{t('report.noBody')}</Text>}
          <View style={styles.translation}>
            <TranslationNote translation={tr.view} reader={tr.reader} original={tr.original} onToggle={tr.toggle} onRetry={tr.retry} quietWhenUnavailable />
          </View>
          {report.mine ? <DeleteReport id={report.id} onDeleted={back} /> : null}
        </>
      )}
    </SheetScroll>
  );
}

/** "Delete my report", then a confirm step (Keep it / Delete), for the author's own report. */
function DeleteReport({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const t = useT('venue');
  const [state, setState] = useState<'idle' | 'confirm' | 'deleting'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setState('deleting');
    setError(null);
    try {
      await deleteReport(id);
      onDeleted();
    } catch (e) {
      setError(t('report.deleteFailed', { reason: friendlyError(e) }));
      setState('confirm');
    }
  }

  if (state === 'idle') {
    return (
      <Pressable onPress={() => setState('confirm')} accessibilityRole="button" style={styles.deleteLink}>
        <Text style={styles.deleteLinkText}>{t('report.delete')}</Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.confirm}>
      <Text style={Type.body}>{t('report.deleteConfirm')}</Text>
      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
      <View style={styles.confirmButtons}>
        <Button label={t('report.deleteKeep')} variant="neutral" onPress={() => { setState('idle'); setError(null); }} style={styles.flex} />
        <Button label={t('report.deleteYes')} variant="danger" onPress={remove} loading={state === 'deleting'} style={styles.flex} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.lg },
  heading: { gap: 8, marginTop: Spacing.sm },
  kind: { ...Face.displayMedium, fontSize: 15, lineHeight: 20, color: Colors.text },
  author: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    marginHorizontal: Spacing.sm,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: Colors.border,
    marginTop: Spacing.sm,
  },
  authorText: { gap: 4 },
  body: { fontFamily: Fonts.text, fontSize: 15, lineHeight: 21, color: Colors.text, marginHorizontal: Spacing.sm },
  noBody: { ...venueText.caption, color: Colors.textMuted, marginHorizontal: Spacing.sm },
  translation: { marginHorizontal: Spacing.sm, marginTop: -Spacing.sm },
  flex: { flex: 1 },
  deleteLink: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginHorizontal: Spacing.sm },
  deleteLinkText: { ...Type.body, color: Colors.danger, textDecorationLine: 'underline' },
  confirm: { gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.md, backgroundColor: Colors.dangerSoft, marginHorizontal: Spacing.sm },
  confirmButtons: { flexDirection: 'row', gap: Spacing.md },
  error: { ...Type.caption, color: Colors.danger },
});
