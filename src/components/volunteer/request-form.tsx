/**
 * "Find a Volunteer" (Figma v3 506:9816, note open 506:9412): where you are, the one thing you need
 * (a radio list), an optional note behind the "Add a note" row, Send Request.
 * Where you are = the current venue and spot (features/venue/current); tap it to pick the spot.
 */
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { FigmaIcon } from '@/components/icons/figma-icon';
import { LanguageSearchModal } from '@/components/language-picker';
import { AppLanguagePill } from '@/components/volunteer/app-language-pill';
import { Colors, Face, Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { isolatedLanguageName, languageName } from '@/features/profile/options';
import { useWhereAmI } from '@/features/venue/current';
import { meetPointFrom, meetSpotLabel, meetVenueName } from '@/features/volunteer/meet-point';
import { HELP_TYPES } from '@/features/volunteer/mock';
import { EMPTY_DRAFT, volunteerRequests } from '@/features/volunteer/request-store';
import type { HelpTypeId, RequestDraft, RequestState } from '@/features/volunteer/types';
import { useDictation } from '@/features/voice/use-dictation';
import { useLayoutRtl, useT } from '@/i18n';

import { EmergencyCard } from './emergency-card';
import { chosenHelpType, HelpRow } from './help-card';
import { Hint, useHint } from './hint';
import { LocationPicker } from './location-picker';
import { NoteBanner } from './note-banner';
import { NOTE_MAX, NoteBox } from './note-box';
import { NoteToggle } from './note-toggle';


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
  const tc = useT('common');
  const tv = useT('venue');
  const rtl = useLayoutRtl();
  const [pickingSpot, setPickingSpot] = useState(false);
  const location = meetPointFrom(useWhereAmI());
  const spot = meetSpotLabel(location, tv, t);
  const venueName = meetVenueName(location);
  // Tap to dictate into the note (added after what's typed); tap again to stop. Interim words show
  // from liveText; the saved draft only changes when they settle.
  const dictation = useDictation({ onCommit: text => edit({ note: text.slice(0, NOTE_MAX) }), onNote: show });
  const [finishing, setFinishing] = useState(false);
  const chosen = chosenHelpType(helpTypes);
  // The note box sits behind the "Add a note" row; it starts open when the draft already has a note or picture.
  const [noteOpen, setNoteOpen] = useState(() => !!(note || photoUri));
  // Set when the row itself opened the box, so the text box takes focus (not when the camera or mic did).
  const [focusNote, setFocusNote] = useState(false);
  const showNote = noteOpen || dictation.listening;

  function choose(id: HelpTypeId) {
    setError(null);
    edit({ helpTypes: [id] });
  }

  function toggleNote() {
    // Closing would hide what's typed or attached, so the row only closes an empty box.
    if (showNote && !note && !photoUri && !dictation.listening) {
      setNoteOpen(false);
      return;
    }
    setFocusNote(!showNote);
    setNoteOpen(true);
  }

  async function addPicture() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return show(t('form.photoOff'));
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!result.canceled && result.assets[0]) edit({ photoUri: result.assets[0].uri });
  }

  async function send() {
    if (!chosen) return setError(t('form.pickOne'));
    if (finishing) return;
    let text = note;
    if (dictation.listening) {
      // Let the recogniser finish the last words (a few seconds at most) so they're sent too.
      setFinishing(true);
      text = ((await dictation.complete()) ?? note).slice(0, NOTE_MAX);
      setFinishing(false);
    }
    volunteerRequests.dismissNotice();
    // Still a list for the database's help_types column; one item since the list is single-choice.
    void volunteerRequests.sendRequest({ visitorName, helpTypes: [chosen], note: text.trim(), photoUri, language, location });
  }

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        {/* The app language, as on every tab. The help language is its own control below. */}
        <View style={styles.appLang}>
          <AppLanguagePill />
        </View>
        <View style={styles.titles}>
          <Text style={styles.title} accessibilityRole="header">{t('form.title')}</Text>
          <Text style={styles.subtitle}>{t('form.subtitle')}</Text>
          {/* The language you want help in, sent with the request; starts as your main language. */}
          <Pressable
            onPress={() => setPickingLanguage(true)}
            accessibilityRole="button"
            accessibilityLabel={t('form.languageLabel', { language: isolatedLanguageName(language) })}
            style={({ pressed }) => [styles.langPill, pressed && styles.langPressed]}>
            <FigmaIcon name="icon-c513eb" size={16} color={Colors.primary} />
            <Text style={styles.langText} numberOfLines={1}>{t('helpIn', { language: languageName(language) })}</Text>
          </Pressable>
        </View>
      </View>

      {notice ? (
        <NoteBanner tone={notice.tone} text={t(`notice.${notice.key}`, { name: notice.params?.name ?? '' })} onDismiss={volunteerRequests.dismissNotice} />
      ) : null}

      <Pressable
        onPress={() => setPickingSpot(true)}
        accessibilityRole="button"
        accessibilityLabel={spot ? t('form.locationLabel', { spot, venue: venueName }) : t('form.locationUnset', { venue: venueName })}
        accessibilityHint={t('form.locationHint', { venue: venueName })}
        style={({ pressed }) => [styles.location, !spot && styles.locationUnset, pressed && styles.locationPressed]}>
        <FigmaIcon name="location-on" size={36} color={spot ? Colors.ink : Colors.primary} />
        {/* Lines start on the layout's start edge even when they begin with a Latin name ("Intuit Dome"). */}
        <View style={styles.locationText}>
          <Text style={[styles.spot, rtl ? styles.rtlText : styles.ltrText]}>{spot ?? t('form.whereAreYou')}</Text>
          <Text style={[styles.venue, rtl ? styles.rtlText : styles.ltrText]}>{spot ? venueName : `${venueName} · ${t('form.tapToChoose')}`}</Text>
        </View>
        {/* Points to the end edge: left in right-to-left languages. */}
        <View style={rtl && styles.flip}>
          <FigmaIcon name="group-2-af556f" size={28} color={Colors.ink} />
        </View>
      </Pressable>

      <View style={styles.helpTypes}>
        <Text style={styles.question} accessibilityRole="header">{t('form.question')}</Text>
        <View style={styles.list} accessibilityRole="radiogroup" accessibilityLabel={t('form.question')}>
          {HELP_TYPES.map(id => (
            <HelpRow key={id} type={id} selected={chosen === id} onPress={() => choose(id)} />
          ))}
        </View>
      </View>

      <View style={styles.note}>
        <NoteToggle
          open={showNote}
          onToggle={toggleNote}
          onAddPicture={() => { setNoteOpen(true); void addPicture(); }}
          onSpeak={() => { setNoteOpen(true); dictation.toggle(note); }}
          listening={dictation.listening}
        />
        {showNote ? (
          <NoteBox
            hideLabel
            autoFocus={focusNote}
            value={dictation.liveText?.slice(0, NOTE_MAX) ?? note}
            onChangeText={text => { edit({ note: text }); dictation.edit(text); }}
            placeholder={t('form.notePlaceholder')}
            photoUri={photoUri}
            onAddPicture={addPicture}
            onRemovePicture={() => edit({ photoUri: null })}
            onSpeak={() => dictation.toggle(note)}
            speakLabel={tc('media.tapToSpeak')}
            listening={dictation.listening}
          />
        ) : null}
        <Hint text={hint} />
      </View>

      <View style={styles.actions}>
        {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
        <Button label={t('form.send')} size="lg" onPress={() => void send()} loading={finishing} style={styles.send} />
        <EmergencyCard />
      </View>

      <LocationPicker visible={pickingSpot} onClose={() => setPickingSpot(false)} />

      <LanguageSearchModal
        visible={pickingLanguage}
        selected={language}
        onSelect={code => { edit({ language: code }); setPickingLanguage(false); }}
        onClose={() => setPickingLanguage(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: Spacing.xl },
  header: { gap: 0 },
  // No negative margin: a long title ("Maghanap ng Volunteer") runs under the language pill.
  titles: { gap: 5, marginTop: 2 },
  title: { ...Type.title, ...Face.displaySemiBold, fontSize: 25, lineHeight: 30 },
  subtitle: { fontFamily: Fonts.text, fontSize: 14, lineHeight: 18, color: Colors.text },
  appLang: { alignSelf: 'flex-end' },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: Colors.primarySoft,
  },
  langPressed: { opacity: 0.7 },
  langText: { fontFamily: Fonts.text, fontSize: 14, color: Colors.primary, flexShrink: 1 },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    minHeight: 62,
    paddingStart: 28,
    paddingEnd: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.controlBorder,
    backgroundColor: Colors.surface,
  },
  // No spot yet: a dashed blue outline asks for a tap.
  locationUnset: { borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed' },
  locationPressed: { backgroundColor: Colors.primarySoft },
  locationText: { flex: 1, gap: 2 },
  flip: { transform: [{ scaleX: -1 }] },
  rtlText: { writingDirection: 'rtl' },
  ltrText: { writingDirection: 'ltr' },
  spot: { ...Type.body },
  venue: { fontFamily: Fonts.text, fontSize: 13, lineHeight: 16, color: Colors.text },
  helpTypes: { gap: Spacing.lg },
  question: { ...Type.body, fontSize: 16, lineHeight: 21 },
  // Figma spaces the rows 15pt apart.
  list: { gap: 14 },
  note: { gap: Spacing.lg },
  actions: { gap: Spacing.lg, marginTop: Spacing.xl },
  send: { minHeight: 52 },
  error: { ...Type.caption, color: Colors.danger, textAlign: 'center' },
});
