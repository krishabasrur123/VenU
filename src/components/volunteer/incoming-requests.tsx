/** A volunteer's Volunteer tab until matching is live: example requests nearby. */
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Colors, Fonts, Radius, Shadow, Spacing, Type } from '@/constants/theme';
import { isolatedLanguageName } from '@/features/profile/options';
import { formatDistance } from '@/features/volunteer/format';
import { mockIncoming } from '@/features/volunteer/mock';
import { useT } from '@/i18n';

import { HelpIcon } from './help-icon';
import { Hint, useHint } from './hint';

export function IncomingRequests() {
  const { hint, show } = useHint();
  const t = useT('volunteer');
  return (
    <View style={styles.page}>
      <View style={styles.titles}>
        <Text style={styles.title} accessibilityRole="header">{t('incoming.title')}</Text>
        <Text style={styles.subtitle}>{t('incoming.subtitle')}</Text>
      </View>

      <View style={styles.preview}>
        <Text style={styles.previewText}>{t('incoming.preview')}</Text>
      </View>
      <Hint text={hint} />

      {mockIncoming().map(r => {
        const help = t(`helpTypes.${r.helpType}`);
        return (
          <View key={r.id} style={styles.card}>
            <View style={styles.top}>
              <View style={styles.iconTile}>
                <HelpIcon type={r.helpType} size={28} color={Colors.primary} />
              </View>
              <View style={styles.text}>
                <Text style={Type.bodyStrong}>{t('incoming.who', { help, name: r.visitorName })}</Text>
                <Text style={styles.where}>{t('place', { spot: r.spot, venue: r.venue })}</Text>
                <Text style={styles.meta}>
                  {t('incoming.meta', { distance: formatDistance(r.distanceFeet), minutes: r.minutesAgo, language: isolatedLanguageName(r.language) })}
                </Text>
              </View>
            </View>
            <Button label={t('incoming.accept')} variant="outline" onPress={() => show(t('incoming.acceptSoon'))} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: Spacing.lg },
  titles: { gap: 5, paddingTop: 18, marginBottom: Spacing.sm },
  title: { ...Type.title, fontSize: 26, lineHeight: 32 },
  subtitle: { fontFamily: Fonts.text, fontSize: 14, lineHeight: 18, color: Colors.text },
  preview: { padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt },
  previewText: { ...Type.caption, color: Colors.text },
  card: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceAlt,
    backgroundColor: Colors.surface,
    ...Shadow.card,
  },
  top: { flexDirection: 'row', gap: Spacing.md },
  iconTile: { width: 48, height: 48, borderRadius: Radius.md, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  where: { ...Type.caption, color: Colors.text },
  meta: { ...Type.caption },
});
