import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { initials } from '@/features/profile/summary';
import { useT } from '@/i18n';

/**
 * Round profile photo, falling back to initials on a soft tint (as in the mockups), both when
 * there's no photo and when it fails to load (expired link, file cleared from a device cache).
 */
export function Avatar({ name, uri, size = 56 }: { name: string; uri: string | null; size?: number }) {
  // Remember which URI failed, so a new URI (e.g. a re-signed link) gets a fresh try.
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const t = useT('common');
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (uri && uri !== failedUri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.base, box]}
        contentFit="cover"
        onError={() => setFailedUri(uri)}
        accessibilityLabel={name ? t('photo.labelNamed', { name }) : t('photo.labelYours')}
      />
    );
  }
  return (
    <View style={[styles.base, styles.fallback, box]} accessibilityLabel={name ? t('photo.labelNamed', { name }) : t('photo.labelNone')}>
      <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden', backgroundColor: Colors.primarySoft },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontWeight: '700', color: Colors.primary },
});
