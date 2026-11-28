/**
 * "Choose Your Venue": search LA28 venues, ask for a volunteer (volunteers: see requests), or open a venue's map.
 * The language pill switches the app now and saves it as the profile's appLanguage (through
 * <LanguageSync />, which retries if offline), offering only translated languages.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FigmaIcon } from '@/components/icons/figma-icon';
import { LanguageSearchModal } from '@/components/language-picker';
import { NAV_BAR_CLEARANCE } from '@/components/tab-bar';
import { Colors, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { isolatedLanguageName } from '@/features/profile/options';
import { useProfile } from '@/features/profile/profile-context';
import { UNTRANSLATED, useLayoutRtl, useT, useUiLanguage } from '@/i18n';
import { choosePendingLanguage, usePendingLanguage } from '@/i18n/pending-language';
import { errorText } from '@/lib/errors';

import { StadiumCard } from './cards';
import { echoQuery } from './labels';
import { searchVenues } from './mock';
import { InlineNote, SearchField, venueText } from './ui';

export function ChooseVenueScreen() {
  const t = useT('venue');
  const tc = useT('common');
  const rtl = useLayoutRtl();
  // The language on screen, not the stored one: a profile can hold an untranslated language (shown in
  // English), and an unsaved pick shows over the profile's.
  const { language } = useUiLanguage();
  const pending = usePendingLanguage();
  const { userId, profile } = useProfile();
  // Volunteers get the same shortcut to their Volunteer tab, worded for them (they don't ask for help).
  const volunteer = profile?.role === 'volunteer';
  const [query, setQuery] = useState('');
  const [picking, setPicking] = useState(false);
  const venues = searchVenues(query, undefined, t);
  // A pick that couldn't be saved yet (e.g. offline) stays on screen; LanguageSync retries it.
  const note = pending.picked && pending.saveError ? errorText(pending.saveError, tc) : null;

  function pickLanguage(code: string) {
    setPicking(false);
    // Same language again: nothing to switch, but a failed save gets another try.
    // Back to the account's own language: LanguageSync drops the unsaved pick instead of saving.
    // Signed in, the pick belongs to this account: it's never saved to whoever signs in next.
    if (code !== language || pending.saveError) choosePendingLanguage(code, userId ?? undefined);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Pressable
            onPress={() => setPicking(true)}
            style={({ pressed }) => [styles.langButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('choose.languageLabel', { language: isolatedLanguageName(language) })}
            accessibilityHint={t('choose.languageHint')}>
            <FigmaIcon name="icon-c513eb" size={20} color={Colors.ink} />
            <Text style={styles.langText}>{isolatedLanguageName(language)}</Text>
          </Pressable>
        </View>
        {note ? <InlineNote>{note}</InlineNote> : null}

        <View style={styles.titles}>
          <Text style={venueText.title} accessibilityRole="header">{t('choose.title')}</Text>
          <Text style={venueText.caption}>{t('choose.subtitle')}</Text>
        </View>

        <SearchField value={query} onChangeText={setQuery} accessibilityLabel={t('choose.searchLabel')} />

        <Pressable
          onPress={() => router.replace('/volunteer')}
          style={({ pressed }) => [styles.assist, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={volunteer ? t('choose.assistLabelVolunteer') : t('choose.assistLabel')}>
          <FigmaIcon name="volunteer" size={50} color={Colors.primary} />
          <View style={styles.assistText}>
            <Text style={venueText.label}>{volunteer ? t('choose.assistTitleVolunteer') : t('choose.assistTitle')}</Text>
            <Text style={venueText.caption}>{volunteer ? t('choose.assistBodyVolunteer') : t('choose.assistBody')}</Text>
          </View>
          <View style={rtl && styles.flip}>
            <FigmaIcon name="group-2-7ecb6b" size={34} color={Colors.primary} />
          </View>
        </Pressable>

        <View style={styles.list}>
          {venues.map(v => (
            <StadiumCard
              key={v.id}
              venue={v}
              onPress={() => router.push({ pathname: '/venue/[venueId]', params: { venueId: v.id } })}
            />
          ))}
          {!venues.length ? <Text style={styles.empty}>{t('choose.empty', { query: echoQuery(query) })}</Text> : null}
        </View>
      </ScrollView>

      <LanguageSearchModal
        visible={picking}
        title={t('choose.languageTitle')}
        exclude={UNTRANSLATED}
        appLanguage
        selected={language}
        onSelect={pickLanguage}
        onClose={() => setPicking(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: Spacing.gutter, paddingTop: Spacing.md, paddingBottom: NAV_BAR_CLEARANCE, gap: Spacing.lg },
  pressed: { opacity: 0.75 },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: -Spacing.sm },
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.controlBorder,
    backgroundColor: Colors.surface,
    ...Shadow.card,
  },
  langText: { fontFamily: Fonts.text, fontSize: 14, color: Colors.ink },
  titles: { gap: 6 },
  assist: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    minHeight: 73,
    paddingStart: Spacing.xl,
    paddingEnd: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
    marginBottom: Spacing.md,
  },
  assistText: { flex: 1, gap: 2 },
  flip: { transform: [{ scaleX: -1 }] },
  list: { gap: 24 },
  empty: { ...venueText.caption, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.lg },
});
