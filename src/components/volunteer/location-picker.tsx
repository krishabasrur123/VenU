/**
 * "Where are you?": a sheet listing the current venue's facilities to pick your spot from, with the
 * venue tab's search and category chips. Picking sets the current spot; "I'm not sure" clears it.
 * e.g. SoFi Stadium → tap "Entry 4" → the request form reads "Near Entry 4 · SoFi Stadium".
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FigmaIcon } from '@/components/icons/figma-icon';
import { Colors, Face, Fonts, Radius, Spacing, Type, WEB_COLUMN_MAX } from '@/constants/theme';
import { emptyFacilitiesMessage, FacilityIcon } from '@/features/venue/categories';
import { CategoryChips } from '@/features/venue/category-chips';
import { setCurrentSpot, useWhereAmI } from '@/features/venue/current';
import { facilityLocation, facilityName } from '@/features/venue/labels';
import { facilitiesFor, getVenue } from '@/features/venue/mock';
import type { Facility, FacilityCategory } from '@/features/venue/types';
import { SearchField } from '@/features/venue/ui';
import { spotChoices } from '@/features/volunteer/meet-point';
import { useT } from '@/i18n';

export function LocationPicker({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT('volunteer');
  const tv = useT('venue');
  const tc = useT('common');
  const { venueId, facilityId } = useWhereAmI();
  const venue = getVenue(venueId);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FacilityCategory | null>(null);
  const results = spotChoices(facilitiesFor(venueId), query, category, tv);
  const venueName = venue?.name ?? venueId;

  function close() {
    setQuery('');
    setCategory(null);
    onClose();
  }

  function pick(id: string | null) {
    setCurrentSpot(id);
    close();
  }

  function changeVenue() {
    close();
    router.push('/venue');
  }

  const notSure = (
    <Pressable
      onPress={() => pick(null)}
      accessibilityRole="radio"
      accessibilityState={{ checked: facilityId === null }}
      // react-native-web reads only aria-* for state.
      aria-checked={facilityId === null}
      accessibilityLabel={`${t('where.notSure')}. ${t('where.notSureHint')}`}
      style={({ pressed }) => [styles.row, facilityId === null && styles.rowSelected, pressed && styles.rowPressed]}>
      <View style={[styles.icon, styles.unsureIcon]}>
        <Text style={styles.unsureMark} aria-hidden>?</Text>
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{t('where.notSure')}</Text>
        <Text style={styles.rowSub}>{t('where.notSureHint')}</Text>
      </View>
      {facilityId === null ? <FigmaIcon name="check-circle" size={24} color={Colors.primary} /> : null}
    </Pressable>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} presentationStyle="pageSheet">
      <SafeAreaView style={styles.modal}>
        <View style={styles.body}>
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">{t('where.title')}</Text>
            <Pressable onPress={close} style={styles.doneTarget} accessibilityRole="button">
              <Text style={styles.done}>{tc('actions.done')}</Text>
            </Pressable>
          </View>
          <Text style={styles.subtitle}>{t('where.subtitle', { venue: venueName })}</Text>
          <Pressable onPress={changeVenue} accessibilityRole="link" style={styles.linkTarget}>
            <Text style={styles.link}>{t('where.changeVenue')}</Text>
          </Pressable>
          <SearchField value={query} onChangeText={setQuery} placeholder={t('where.search')} accessibilityLabel={t('where.search')} />
          <View style={styles.chips}>
            <CategoryChips value={category} onChange={setCategory} />
          </View>
          <FlatList<Facility>
            data={results}
            keyExtractor={f => f.id}
            keyboardShouldPersistTaps="handled"
            accessibilityRole="radiogroup"
            accessibilityLabel={t('where.title')}
            contentContainerStyle={styles.list}
            ListHeaderComponent={!query && !category ? notSure : undefined}
            ListEmptyComponent={
              <Text style={styles.empty} accessibilityLiveRegion="polite">{emptyFacilitiesMessage(category, query, venueName, tv)}</Text>
            }
            renderItem={({ item }) => {
              const selected = item.id === facilityId;
              const name = facilityName(item, tv);
              const location = facilityLocation(item, tv);
              return (
                <Pressable
                  onPress={() => pick(item.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  aria-checked={selected}
                  accessibilityLabel={tv(item.accessible ? 'row.labelAccessible' : 'row.label', { name, meta: location })}
                  style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.rowPressed]}>
                  <View style={styles.icon}>
                    <FacilityIcon category={item.category} size={28} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle} numberOfLines={2}>{name}</Text>
                    <Text style={styles.rowSub} numberOfLines={2}>{location}</Text>
                  </View>
                  {item.accessible ? <FigmaIcon name="wheelchair-6dc801" size={20} color={Colors.primary} /> : null}
                  {selected ? <FigmaIcon name="check-circle" size={24} color={Colors.primary} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: Colors.bg, paddingHorizontal: Spacing.gutter },
  // Phone-width column even on a desktop browser, same as the app on web.
  body: { flex: 1, width: '100%', maxWidth: WEB_COLUMN_MAX, alignSelf: 'center', gap: Spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Spacing.md },
  title: { fontFamily: Fonts.display, fontSize: 22, lineHeight: 28, color: Colors.text, flexShrink: 1 },
  doneTarget: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  done: { ...Face.textSemiBold, fontSize: 16, color: Colors.primary },
  subtitle: { ...Type.caption, color: Colors.text },
  // Starts on the start edge (right in Arabic); 44pt tall for touch.
  linkTarget: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginTop: -Spacing.sm },
  link: { ...Type.caption, color: Colors.primary, textDecorationLine: 'underline' },
  // The chips run edge to edge and bring their own gutter.
  chips: { marginHorizontal: -Spacing.gutter },
  list: { gap: Spacing.sm, paddingBottom: Spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 60,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceAlt,
    backgroundColor: Colors.surface,
  },
  rowSelected: { borderColor: Colors.primary, borderWidth: 2, backgroundColor: Colors.primarySoft },
  rowPressed: { backgroundColor: Colors.surfaceAlt },
  icon: { width: 32, alignItems: 'center' },
  unsureIcon: { height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: Colors.ink, justifyContent: 'center' },
  unsureMark: { ...Face.textBold, fontSize: 17, color: Colors.ink },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: Fonts.display, fontSize: 17, lineHeight: 22, color: Colors.text },
  rowSub: { ...Type.caption, color: Colors.textMuted },
  empty: { ...Type.caption, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.md },
});
