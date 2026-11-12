/**
 * "Choose Your Venue": search LA28 venues, ask for a volunteer, or open a venue's map.
 * The language pill sets the app language (the profile's appLanguage), offering only translated languages.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FigmaIcon } from '@/components/icons/figma-icon';
import { LanguageSearchModal } from '@/components/language-picker';
import { NAV_BAR_CLEARANCE } from '@/components/tab-bar';
import { Colors, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { isolatedLanguageName, LANGUAGES } from '@/features/profile/options';
import { PRIVACY_VERSION } from '@/features/profile/privacy';
import { useProfile } from '@/features/profile/profile-context';
import { draftFromProfile } from '@/features/profile/types';
import { isUiLanguage, useLayoutRtl, useT } from '@/i18n';
import { choosePendingLanguage } from '@/i18n/pending-language';
import { friendlyError } from '@/lib/errors';

import { StadiumCard } from './cards';
import { searchVenues } from './mock';
import { InlineNote, SearchField, venueText } from './ui';

/** Languages without string tables would show English, so the picker leaves them out. */
const UNTRANSLATED = LANGUAGES.filter(l => !isUiLanguage(l.code)).map(l => l.code);

export function ChooseVenueScreen() {
  const t = useT('venue');
  const rtl = useLayoutRtl();
  const { profile, save } = useProfile();
  const [query, setQuery] = useState('');
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const venues = searchVenues(query, undefined, t);
  const language = saving ?? (profile?.appLanguage || 'en');

  async function pickLanguage(code: string) {
    setPicking(false);
    setNote(null);
    if (!profile) return void choosePendingLanguage(code);
    if (code === profile.appLanguage) return;
    // Saving stamps privacy consent again when the policy changed since they agreed; that needs Profile.
    if (profile.privacyVersion !== PRIVACY_VERSION) return setNote(t('choose.languageConsent'));
    setSaving(code);
    try {
      await save({ ...draftFromProfile(profile), appLanguage: code }, null);
    } catch (e) {
      setNote(friendlyError(e));
    } finally {
      setSaving(null);
    }
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
            accessibilityHint={t('choose.languageHint')}
            accessibilityState={{ busy: !!saving }}
            disabled={!!saving}>
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
          accessibilityLabel={t('choose.assistLabel')}>
          <FigmaIcon name="volunteer" size={50} color={Colors.primary} />
          <View style={styles.assistText}>
            <Text style={venueText.label}>{t('choose.assistTitle')}</Text>
            <Text style={venueText.caption}>{t('choose.assistBody')}</Text>
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
          {!venues.length ? <Text style={styles.empty}>{t('choose.empty', { query: query.trim() })}</Text> : null}
        </View>
      </ScrollView>

      <LanguageSearchModal
        visible={picking}
        title={t('choose.languageTitle')}
        exclude={UNTRANSLATED}
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
