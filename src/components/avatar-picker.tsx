import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { PHOTO_MAX_BYTES, PHOTO_TOO_BIG } from '@/constants/photo';
import { Colors, Spacing, Type } from '@/constants/theme';
import { checkPhoto, type PickedImage } from '@/features/profile/store';
import type { Role } from '@/features/profile/types';
import { languageOf, useT } from '@/i18n';
import { formatNumber } from '@/i18n/format';
import { isLocalMode } from '@/lib/auth';

interface AvatarPickerProps {
  name: string;
  /** What to show now: the new pick, the saved photo, or null. */
  uri: string | null;
  onPick: (image: PickedImage) => void;
  onRemove: () => void;
  /** 'stacked': a large photo you can tap, actions centred under it (Figma "Choose a profile picture" 482:32439). */
  layout?: 'row' | 'stacked';
  /** Whose photo: the hint says who it helps (a visitor's helper, or the visitors a volunteer meets). */
  role: Role;
}

const PICK_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.6,
  // base64 where the upload needs it:
  // - web + local mode: blob: URIs die on reload, so the device store keeps a data URI;
  // - native + Supabase: fetch() on a local file:// URI isn't reliable in RN, so upload decodes base64.
  base64: Platform.OS === 'web' ? isLocalMode : !isLocalMode,
};

/** Photo + "Choose photo" / "Take photo" / "Remove" actions. Must be launched from a tap (web rule). */
export function AvatarPicker({ name, uri, onPick, onRemove, layout = 'row', role }: AvatarPickerProps) {
  const [error, setError] = useState<string | null>(null);
  const t = useT('common');

  async function pick(source: 'library' | 'camera') {
    setError(null);
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError(source === 'camera' ? t('photo.cameraOff') : t('photo.libraryOff'));
      return;
    }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(PICK_OPTIONS)
      : await ImagePicker.launchImageLibraryAsync(PICK_OPTIONS);
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    const image: PickedImage = { uri: asset.uri, mimeType: asset.mimeType ?? null, fileSize: asset.fileSize ?? null, base64: asset.base64 ?? null };
    const problem = checkPhoto(image);
    // checkPhoto answers in English (shared with the store); show the same rule in the UI language.
    if (problem) return setError(problem === PHOTO_TOO_BIG ? t('errors.photoTooBig', { size: formatNumber(PHOTO_MAX_BYTES / 1024 / 1024, undefined, languageOf(t)) }) : t('errors.photoWrongType'));
    onPick(image);
  }

  const stacked = layout === 'stacked';
  return (
    <View style={stacked ? styles.stacked : styles.row}>
      {stacked ? (
        <Pressable onPress={() => pick('library')} accessibilityRole="button" accessibilityLabel={uri ? t('photo.change') : t('photo.add')} style={({ pressed }) => pressed && styles.pressed}>
          <Avatar name={name} uri={uri} size={120} />
        </Pressable>
      ) : (
        <Avatar name={name} uri={uri} size={72} />
      )}
      <View style={stacked ? styles.actionsStacked : styles.actions}>
        <View style={[styles.links, stacked && styles.linksStacked]}>
          <Action label={uri ? t('photo.change') : t('photo.add')} onPress={() => pick('library')} />
          {Platform.OS !== 'web' && <Action label={t('photo.take')} onPress={() => pick('camera')} />}
          {uri && <Action label={t('photo.remove')} onPress={onRemove} muted />}
        </View>
        <Text style={[styles.hint, stacked && styles.hintStacked, error && styles.error]} accessibilityLiveRegion="polite">
          {error ?? (role === 'volunteer' ? t('photo.hintVolunteer') : t('photo.hint'))}
        </Text>
      </View>
    </View>
  );
}

function Action({ label, onPress, muted }: { label: string; onPress: () => void; muted?: boolean }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.target} accessibilityRole="button">
      <Text style={[styles.action, muted && styles.actionMuted]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  stacked: { alignItems: 'center', gap: Spacing.md },
  pressed: { opacity: 0.8 },
  actions: { flex: 1, gap: Spacing.xs },
  actionsStacked: { alignItems: 'center', gap: Spacing.xs },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.lg, rowGap: Spacing.xs },
  linksStacked: { justifyContent: 'center' },
  hintStacked: { textAlign: 'center' },
  target: { minHeight: 32, justifyContent: 'center' }, // >= 24px on web too, where hitSlop is ignored
  action: { ...Type.label, color: Colors.primary },
  actionMuted: { color: Colors.textMuted },
  hint: Type.caption,
  error: { color: Colors.danger },
});
