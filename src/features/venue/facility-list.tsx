/** Sheet content: "Facilities Near You", nearest first, filtered by the header chip and the search. */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { useT } from '@/i18n';

import { FacilityRow } from './cards';
import { emptyFacilitiesMessage } from './categories';
import { categoryLabel } from './labels';
import { searchFacilities } from './mock';
import { SheetScroll, useVenueScreen } from './venue-map-screen';
import { SearchField, venueText } from './ui';

export function FacilityList() {
  const t = useT('venue');
  const { venue, facilities, category, setCategory, snap, setSnap, setFreshReport } = useVenueScreen();
  const [query, setQuery] = useState('');
  const results = searchFacilities(facilities, query, category, t).sort((a, b) => a.walkMinutes - b.walkMinutes);

  // Back on the list = the user left the facility, so a just-submitted report is no longer "New".
  useEffect(() => { setFreshReport(null); }, [setFreshReport]);

  return (
    <SheetScroll contentContainerStyle={styles.content}>
      <Text style={venueText.title} accessibilityRole="header">{t('list.title')}</Text>
      <SearchField
        value={query}
        onChangeText={text => { setQuery(text); if (snap === 'down') setSnap('mid'); }}
        accessibilityLabel={t('list.searchLabel')}
      />
      {category ? (
        <Text style={styles.filter} onPress={() => setCategory(null)} accessibilityRole="button" accessibilityHint={t('list.showAllHint')}>
          {`${t('list.showing', { category: categoryLabel(category, t) })} · `}<Text style={styles.link}>{t('list.showAll')}</Text>
        </Text>
      ) : null}
      <View style={styles.list}>
        {results.map(f => (
          <FacilityRow
            key={f.id}
            facility={f}
            onPress={() => {
              if (snap === 'down') setSnap('mid');
              router.push({ pathname: '/venue/[venueId]/[facilityId]', params: { venueId: venue.id, facilityId: f.id } });
            }}
          />
        ))}
        {!results.length ? (
          <Text style={styles.empty} accessibilityLiveRegion="polite">{emptyFacilitiesMessage(category, query, venue.name, t)}</Text>
        ) : null}
      </View>
    </SheetScroll>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14 },
  list: { gap: 14, paddingTop: 2 },
  filter: { ...venueText.caption, color: Colors.textMuted },
  link: { color: Colors.primary, textDecorationLine: 'underline' },
  empty: { ...venueText.caption, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.md },
});
