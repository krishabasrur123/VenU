/**
 * The request a volunteer accepted, on their Volunteer tab in place of "Incoming requests": who,
 * what they need, where, then Message (with a dot for unread), End chat (the help is done) and
 * Can't make it (hands it back to other volunteers). Both ask first, inline.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Colors, Fonts, Radius, Shadow, Spacing, Type } from '@/constants/theme';
import { uiLanguageName } from '@/features/profile/summary';
import { volunteerDesk } from '@/features/volunteer/desk-store';
import type { Assignment } from '@/features/volunteer/types';
import { useT } from '@/i18n';

import { HelpIcon } from './help-icon';
import { MeetPlaceText } from './meet-place';
import { MessageButton } from './message-button';
import { RequestNote } from './request-note';

export function ActiveRequest({ assignment: a, unread }: { assignment: Assignment; unread: number }) {
  const t = useT('volunteer');
  const tp = useT('profile');
  const [confirming, setConfirming] = useState<'end' | 'handBack' | null>(null);
  const [handingBack, setHandingBack] = useState(false);
  const [handBackFailed, setHandBackFailed] = useState(false);
  const openChat = () => router.push({ pathname: '/chat/[id]', params: { id: a.id } });
  const help = a.helpTypes.map(h => t(`helpTypes.${h}`)).join(' · ');

  async function handBack() {
    setHandingBack(true);
    setHandBackFailed(false);
    // On success the card goes away (the desk drops the assignment), so only a failure needs state.
    if (!(await volunteerDesk.handBack())) {
      setHandingBack(false);
      setHandBackFailed(true);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.titles}>
          <Text style={styles.title} accessibilityRole="header">{t('active.title', { name: a.visitorName })}</Text>
          <Text style={styles.subtitle}>{t('active.subtitle')}</Text>
        </View>
        <MessageButton unread={unread} onPress={openChat} />
      </View>

      <View style={styles.top}>
        <View style={styles.iconTile}>
          <HelpIcon type={a.helpTypes[0] ?? 'other'} size={28} color={Colors.primary} />
        </View>
        <View style={styles.text}>
          <Text style={Type.bodyStrong}>{help}</Text>
          <MeetPlaceText point={a.location} style={styles.line} />
          <Text style={styles.line}>{t('helpIn', { language: uiLanguageName(a.language, tp) })}</Text>
          {a.note ? <RequestNote requestId={a.id} note={a.note} lang={a.language} style={styles.line} /> : null}
        </View>
      </View>

      <Button label={t('chat.messageTo', { name: a.visitorName })} onPress={openChat} />
      {confirming === 'end' ? (
        <View style={styles.confirm} accessibilityLiveRegion="polite">
          <Text style={Type.body}>{t('active.confirmEnd', { name: a.visitorName })}</Text>
          <View style={styles.buttons}>
            <Button label={t('match.notYet')} variant="neutral" onPress={() => setConfirming(null)} style={styles.flex} />
            <Button label={t('active.yesEnd')} onPress={volunteerDesk.endChat} style={styles.flex} />
          </View>
        </View>
      ) : (
        <Button label={t('active.end')} variant="outline" onPress={() => setConfirming('end')} accessibilityHint={t('active.endHint', { name: a.visitorName })} />
      )}
      {confirming === 'handBack' ? (
        <View style={styles.confirmBack} accessibilityLiveRegion="polite">
          <Text style={Type.body}>{t('active.confirmHandBack', { name: a.visitorName })}</Text>
          {handBackFailed ? <Text style={styles.error}>{t('active.handBackFailed')}</Text> : null}
          <View style={styles.buttons}>
            <Button label={t('active.keepHelping')} variant="neutral" onPress={() => { setConfirming(null); setHandBackFailed(false); }} style={styles.flex} />
            <Button label={t('active.yesHandBack')} variant="danger" onPress={() => void handBack()} loading={handingBack} style={styles.flex} />
          </View>
        </View>
      ) : (
        <Button
          label={t('active.handBack')}
          variant="link"
          onPress={() => setConfirming('handBack')}
          accessibilityHint={t('active.handBackHint', { name: a.visitorName })}
          style={styles.link}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
    ...Shadow.card,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  titles: { flex: 1, gap: 4 },
  title: { ...Type.title, fontSize: 22, lineHeight: 28 },
  subtitle: { fontFamily: Fonts.text, fontSize: 14, lineHeight: 18, color: Colors.text },
  top: { flexDirection: 'row', gap: Spacing.md },
  iconTile: { width: 48, height: 48, borderRadius: Radius.md, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  line: { ...Type.caption, color: Colors.text },
  confirm: { gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.md, backgroundColor: Colors.primarySoft },
  confirmBack: { gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.md, backgroundColor: Colors.dangerSoft },
  error: { ...Type.caption, color: Colors.danger },
  link: { alignSelf: 'center' },
  buttons: { flexDirection: 'row', gap: Spacing.md },
  flex: { flex: 1 },
});
