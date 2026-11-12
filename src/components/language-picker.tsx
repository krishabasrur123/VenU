import { useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View, type TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { Button } from '@/components/button';
import { FigmaIcon } from '@/components/icons/figma-icon';
import { Colors, Fonts, Radius, Shadow, Spacing, Type, WEB_COLUMN_MAX } from '@/constants/theme';
import { LANGUAGES, languageName, searchLanguages, type Language } from '@/features/profile/options';
import { useLayoutRtl, useT } from '@/i18n';

/**
 * Language names line up at the start edge whatever their script: "العربية" sits left in an English
 * list and "English" sits right in an Arabic one (otherwise each name aligns by its own script).
 * Web: `direction` picks the start edge. Native already reads 'left' as the start edge in RTL.
 */
function useNameDirection(): TextStyle {
  const rtl = useLayoutRtl();
  const writingDirection = rtl ? 'rtl' : 'ltr';
  return Platform.OS === 'web' ? { writingDirection } : { writingDirection, textAlign: 'left' };
}

/** "Primary language", "Secondary language", then "Another language". */
function slotName(t: ReturnType<typeof useT<'common'>>, index: number): string {
  return index === 0 ? t('language.primary') : index === 1 ? t('language.secondary') : t('language.another');
}

interface LanguagePickerProps {
  languages: string[];
  main: string;
  /** `main` is '' while the primary field is cleared (validation then asks for one). */
  onChange: (languages: string[], main: string) => void;
}

/**
 * Figma "Languages you speak": a Primary and a Secondary search field, then one more field per
 * "Add another language". e.g. Primary [Español ⊗] / Secondary [English ⊗] / [⊕ Add another language]
 */
export function LanguagePicker({ languages, main, onChange }: LanguagePickerProps) {
  const t = useT('common');
  // Every field on screen, in order: [Primary, Secondary, …]; null is an empty field.
  // e.g. ['es', 'en', null] = Español / English / an added field not filled in yet.
  const [slots, setSlots] = useState<(string | null)[]>(() => slotsFrom(languages, main));
  // Languages changed from outside (e.g. the form reset): start over from them.
  const rows = slotsMatch(slots, languages, main) ? slots : slotsFrom(languages, main);

  function update(next: (string | null)[]) {
    while (next.length < 2) next.push(null); // Secondary is always offered
    setSlots(next);
    onChange(next.filter((c): c is string => !!c), next[0] ?? '');
  }

  function select(index: number, code: string) {
    update(rows.map((c, i) => (i === index ? code : c)));
  }

  function clear(index: number) {
    // Primary keeps its place while empty; any other field goes, and the ones below move up.
    update(index === 0 ? [null, ...rows.slice(1)] : rows.filter((_, i) => i !== index));
  }

  return (
    <View style={styles.list}>
      {rows.map((code, i) => (
        <View key={`${i}-${code ?? 'empty'}`} style={styles.slot}>
          <Text style={styles.slotLabel}>{slotName(t, i)}</Text>
          <LanguageMenuField
            value={code}
            fieldName={slotName(t, i)}
            exclude={rows.filter((c): c is string => !!c && c !== code)}
            onSelect={c => select(i, c)}
            // An empty extra field can be removed; an empty Primary/Secondary has nothing to clear.
            onClear={code || i >= 2 ? () => clear(i) : undefined}
          />
        </View>
      ))}
      {rows.length < LANGUAGES.length && (
        <Button
          label={t('language.add')}
          variant="neutral"
          icon={<FigmaIcon name="add-circle" size={24} color={Colors.ink} />}
          onPress={() => setSlots([...rows, null])}
          style={styles.add}
        />
      )}
    </View>
  );
}

/** Fields for saved languages: primary first, then the rest, padded to Primary + Secondary. */
function slotsFrom(languages: string[], main: string): (string | null)[] {
  const primary = main && languages.includes(main) ? main : null;
  const rows: (string | null)[] = [primary, ...languages.filter(l => l !== primary)];
  while (rows.length < 2) rows.push(null);
  return rows;
}

/** True when the fields hold exactly these languages, with `main` (if any) in the Primary field. */
function slotsMatch(slots: (string | null)[], languages: string[], main: string): boolean {
  const filled = slots.filter((c): c is string => !!c);
  const primary = main && languages.includes(main) ? main : null;
  return slots[0] === primary && filled.length === languages.length && filled.every(c => languages.includes(c));
}

/** ⊗ from the Figma text field's trailing icon. */
function ClearIcon({ size = 24, color = Colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9.25} stroke={color} strokeWidth={1.8} />
      <Path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

interface LanguageMenuFieldProps {
  value: string | null;
  /** For screen readers, e.g. "Primary language". */
  fieldName: string;
  exclude: string[];
  onSelect: (code: string) => void;
  onClear?: () => void;
}

/**
 * Figma "Menu with Text field": a filled field (🔍 Search Languages / value / ⊗). Tapping it turns
 * it into a search box with a menu of matches underneath; picking one closes it.
 */
export function LanguageMenuField({ value, fieldName, exclude, onSelect, onClear }: LanguageMenuFieldProps) {
  const t = useT('common');
  const nameDirection = useNameDirection();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const results = searchLanguages(query).filter(l => !exclude.includes(l.code)).slice(0, 6);

  useEffect(() => () => { if (blurTimer.current) clearTimeout(blurTimer.current); }, []);

  function close() {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setOpen(false);
    setQuery('');
  }

  function pick(code: string) {
    close();
    onSelect(code);
  }

  return (
    <View>
      <View style={[styles.field, open && styles.fieldOpen]}>
        <View style={styles.lead}>
          <FigmaIcon name="leading-icon-de9321" size={44} color={Colors.ink} />
        </View>
        {open ? (
          <View style={styles.content}>
            <Text style={styles.label}>{t('language.search')}</Text>
            <TextInput
              style={styles.input}
              value={query}
              onChangeText={setQuery}
              placeholder={value ? languageName(value) : t('language.examples')}
              placeholderTextColor={Colors.textFaint}
              autoFocus
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => (results[0] ? pick(results[0].code) : close())}
              // Let a tap on a menu item land before the menu closes (web blurs on mousedown).
              onBlur={() => { blurTimer.current = setTimeout(close, 200); }}
              accessibilityLabel={t('language.searchFor', { field: fieldName })}
            />
          </View>
        ) : (
          <Pressable
            style={styles.content}
            onPress={() => setOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={value ? t('language.field', { field: fieldName, language: languageName(value) }) : t('language.fieldEmpty', { field: fieldName })}
            accessibilityHint={t('language.openHint')}>
            <Text style={styles.label}>{t('language.fieldLabel')}</Text>
            <Text style={[styles.value, value ? nameDirection : styles.placeholder]} numberOfLines={1}>
              {value ? languageName(value) : t('language.choose')}
            </Text>
          </Pressable>
        )}
        {open || onClear ? (
          <Pressable
            onPress={open ? close : onClear}
            style={styles.trail}
            accessibilityRole="button"
            accessibilityLabel={open ? t('language.closeSearch') : value ? t('language.remove', { language: languageName(value) }) : t('language.removeField')}>
            <ClearIcon />
          </Pressable>
        ) : (
          <View style={styles.trailSpacer} />
        )}
      </View>
      {open && (
        <View style={styles.menu} accessibilityRole="menu">
          {results.length === 0 ? (
            <Text style={styles.empty}>{t('language.noMatch')}</Text>
          ) : (
            results.map(l => (
              <Pressable
                key={l.code}
                onPress={() => pick(l.code)}
                style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                accessibilityRole="menuitem"
                accessibilityLabel={`${l.native}, ${l.english}`}>
                <Text style={[styles.menuNative, nameDirection]}>{l.native}</Text>
                {l.native !== l.english && <Text style={[styles.menuEnglish, nameDirection]}>{l.english}</Text>}
              </Pressable>
            ))
          )}
        </View>
      )}
    </View>
  );
}

interface LanguageSearchModalProps {
  visible: boolean;
  /** Sheet heading; defaults to "Add a language". */
  title?: string;
  exclude?: string[];
  onSelect: (code: string) => void;
  onClose: () => void;
}

/** Full-screen searchable list; names shown in their own script with the English name underneath. */
export function LanguageSearchModal({ visible, title, exclude = [], onSelect, onClose }: LanguageSearchModalProps) {
  const t = useT('common');
  const nameDirection = useNameDirection();
  const [query, setQuery] = useState('');
  const results = searchLanguages(query).filter(l => !exclude.includes(l.code));

  function close() {
    setQuery('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} presentationStyle="pageSheet">
      <SafeAreaView style={styles.modal}>
        <View style={styles.modalBody}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} accessibilityRole="header">{title ?? t('language.addTitle')}</Text>
            <Pressable onPress={close} style={styles.doneTarget} accessibilityRole="button">
              <Text style={styles.done}>{t('actions.done')}</Text>
            </Pressable>
          </View>
          <View style={styles.searchBox}>
            <FigmaIcon name="leading-icon-de9321" size={40} color={Colors.ink} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('language.searchExamples')}
              placeholderTextColor={Colors.textFaint}
              value={query}
              onChangeText={setQuery}
              autoFocus
              autoCorrect={false}
              accessibilityLabel={t('language.search')}
            />
          </View>
          <FlatList<Language>
            data={results}
            keyExtractor={l => l.code}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            ListEmptyComponent={<Text style={styles.empty}>{t('language.noMatch')}</Text>}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.item, pressed && styles.menuItemPressed]}
                onPress={() => {
                  setQuery('');
                  onSelect(item.code);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${item.native}, ${item.english}`}>
                <Text style={[styles.menuNative, nameDirection]}>{item.native}</Text>
                {item.native !== item.english && <Text style={[styles.menuEnglish, nameDirection]}>{item.english}</Text>}
              </Pressable>
            )}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.lg },
  slot: { gap: 6 },
  slotLabel: { fontFamily: Fonts.text, fontSize: 13, lineHeight: 16, color: Colors.text, paddingStart: Spacing.xs },
  add: { marginHorizontal: Spacing.xl, marginTop: Spacing.sm },

  // Figma: #F5F5F5 fill, radius 10, 45 tall; 56 here for two readable lines.
  field: { flexDirection: 'row', alignItems: 'center', minHeight: 56, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt },
  fieldOpen: { borderBottomStartRadius: 4, borderBottomEndRadius: 4, borderBottomWidth: 3, borderBottomColor: Colors.ink },
  lead: { width: 52, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, minHeight: 52, justifyContent: 'center', paddingVertical: 4 },
  label: { fontFamily: Fonts.text, fontSize: 13, lineHeight: 16, color: Colors.textMuted },
  value: { fontFamily: Fonts.display, fontSize: 16, lineHeight: 22, color: Colors.text },
  placeholder: { color: Colors.textFaint },
  input: { fontFamily: Fonts.display, fontSize: 16, lineHeight: 22, color: Colors.text, paddingVertical: 0, outlineStyle: 'none' } as object,
  trail: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginEnd: 4 },
  trailSpacer: { width: 52 },

  menu: { marginTop: 2, paddingVertical: Spacing.sm, borderRadius: 4, backgroundColor: Colors.surfaceAlt, ...Shadow.card },
  menuItem: { minHeight: 44, paddingHorizontal: Spacing.lg, paddingVertical: 6, justifyContent: 'center' },
  menuItemPressed: { backgroundColor: Colors.primarySoft },
  menuNative: { fontFamily: Fonts.display, fontSize: 15, lineHeight: 20, color: Colors.text },
  menuEnglish: { ...Type.caption },
  empty: { ...Type.caption, textAlign: 'center', paddingVertical: Spacing.md },

  modal: { flex: 1, backgroundColor: Colors.bg, paddingHorizontal: Spacing.gutter },
  // Phone-width column even on a desktop browser, same as the app on web.
  modalBody: { flex: 1, width: '100%', maxWidth: WEB_COLUMN_MAX, alignSelf: 'center' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md },
  modalTitle: { fontFamily: Fonts.display, fontSize: 22, lineHeight: 28, color: Colors.text },
  doneTarget: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  done: { ...Type.bodyStrong, color: Colors.primary },
  searchBox: { flexDirection: 'row', alignItems: 'center', minHeight: 52, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt, paddingStart: 4, marginBottom: Spacing.md },
  searchInput: { ...Type.input, flex: 1, paddingVertical: 12, paddingEnd: Spacing.lg, outlineStyle: 'none' } as object,
  item: { minHeight: 52, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs, gap: 2, justifyContent: 'center' },
  sep: { height: 1, backgroundColor: Colors.divider },
});
