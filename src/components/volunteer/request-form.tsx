/** "Find a Volunteer" (Figma 192:22809): where you are, what you need, a note, Send Request. */
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { FigmaIcon } from '@/components/icons/figma-icon';
import { LanguageSearchModal } from '@/components/language-picker';
import { Colors, Fonts, Radius, Shadow, Spacing, Type } from '@/constants/theme';
import { isolatedLanguageName, languageName } from '@/features/profile/options';
import { HELP_TYPES, mockLocation } from '@/features/volunteer/mock';
import { EMPTY_DRAFT, volunteerRequests } from '@/features/volunteer/request-store';
import type { HelpTypeId, RequestDraft, RequestState } from '@/features/volunteer/types';
import { useT } from '@/i18n';

import { EmergencyCard } from './emergency-card';
import { HelpCard } from './help-card';
import { Hint, useHint } from './hint';
import { NoteBanner } from './note-banner';
import { NoteBox } from './note-box';

interface RequestFormProps {
  visitorName: string;
  defaultLanguage: string;
  notice: RequestState['notice'];
  /** The fields as last filled in (kept in the store, so a failed search or a cancel keeps them). */
  draft: RequestDraft | null;
}

export function RequestForm({ visitorName, defaultLanguage, notice, draft }: RequestFormProps) {
  const { helpTypes, note, photoUri } = draft ?? EMPTY_DRAFT;
  const language = draft?.language ?? defaultLanguage;
  const edit = volunteerRequests.editDraft;
  const [pickingLanguage, setPickingLanguage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { hint, show } = useHint();
  const t = useT('volunteer');
  const location = mockLocation();

  function toggle(id: HelpTypeId) {
    setError(null);
    edit({ helpTypes: helpTypes.includes(id) ? helpTypes.filter(x => x !== id) : [...helpTypes, id] });
  }

  async function addPicture() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return show(t('form.photoOff'));
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!result.canceled && result.assets[0]) edit({ photoUri: result.assets[0].uri });
  }

  function send() {
    if (!helpTypes.length) return setError(t('form.pickOne'));
    volunteerRequests.dismissNotice();
    // Ordered as on screen, so the volunteer sees the same list.
    const ordered = HELP_TYPES.filter(id => helpTypes.includes(id));
    void volunteerRequests.sendRequest({ visitorName, helpTypes: ordered, note: note.trim(), photoUri, language, location });
  }

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        {/* Figma's small segmented control: the language you want help in. */}
        <Pressable
          onPress={() => setPickingLanguage(true)}
          accessibilityRole="button"
          accessibilityLabel={t('form.languageLabel', { language: isolatedLanguageName(language) })}
          style={({ pressed }) => [styles.langPill, pressed && styles.langPressed]}>
          <FigmaIcon name="icon-c513eb" size={18} color={Colors.ink} />
          <Text style={styles.langText} numberOfLines={1}>{languageName(language)}</Text>
        </Pressable>
        <View style={styles.titles}>
          <Text style={styles.title} accessibilityRole="header">{t('form.title')}</Text>
          <Text style={styles.subtitle}>{t('form.subtitle')}</Text>
        </View>
      </View>

      {notice ? <NoteBanner notice={notice} onDismiss={volunteerRequests.dismissNotice} /> : null}

      <View style={styles.location} accessible accessibilityLabel={t('form.locationLabel', { spot: location.spot, venue: location.venue })}>
        <FigmaIcon name="location-on" size={36} color={Colors.ink} />
        <View style={styles.locationText}>
          <Text style={styles.spot}>{location.spot}</Text>
          <Text style={styles.venue}>{location.venue}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.question} accessibilityRole="header">{t('form.question')}</Text>
        <View style={styles.grid}>
          {[0, 3].map(start => (
            <View key={start} style={styles.gridRow}>
              {HELP_TYPES.slice(start, start + 3).map(id => (
                <HelpCard key={id} type={id} selected={helpTypes.includes(id)} onPress={() => toggle(id)} />
              ))}
            </View>
          ))}
        </View>
      </View>

      <NoteBox
        value={note}
        onChangeText={text => edit({ note: text })}
        placeholder={t('form.notePlaceholder')}
        photoUri={photoUri}
        onAddPicture={addPicture}
        onRemovePicture={() => edit({ photoUri: null })}
        onSpeak={() => show(t('form.voiceSoon'))}
      />
      <Hint text={hint} />

      <View style={styles.actions}>
        {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
        <Button label={t('form.send')} size="lg" onPress={send} style={styles.send} />
        <EmergencyCard />
      </View>

      <LanguageSearchModal
        visible={pickingLanguage}
        onSelect={code => { edit({ language: code }); setPickingLanguage(false); }}
        onClose={() => setPickingLanguage(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: Spacing.xl },
  header: { gap: 0 },
  titles: { gap: 5, marginTop: -8 },
  title: { ...Type.title, fontSize: 26, lineHeight: 32 },
  subtitle: { fontFamily: Fonts.text, fontSize: 14, lineHeight: 18, color: Colors.text },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 36,
    maxWidth: 160,
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.controlBorder,
    backgroundColor: Colors.surface,
    ...Shadow.card,
  },
  langPressed: { backgroundColor: Colors.primarySoft },
  langText: { fontFamily: Fonts.text, fontSize: 14, color: Colors.text, flexShrink: 1 },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    minHeight: 62,
    paddingHorizontal: 28,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceAlt,
  },
  locationText: { gap: 2 },
  spot: { ...Type.body },
  venue: { fontFamily: Fonts.text, fontSize: 13, lineHeight: 16, color: Colors.text },
  section: { gap: Spacing.lg },
  question: { ...Type.body },
  grid: { gap: Spacing.lg },
  gridRow: { flexDirection: 'row', gap: Spacing.md },
  actions: { gap: Spacing.lg, marginTop: Spacing.md },
  send: { minHeight: 52 },
  error: { ...Type.caption, color: Colors.danger, textAlign: 'center' },
});
