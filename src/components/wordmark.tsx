import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';

/** "VenU" with the blue "Ven" and orange "U" from the mockups. */
export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <Text style={[styles.base, { fontSize: size, letterSpacing: size > 30 ? -1 : -0.3 }]} accessibilityRole="header" accessibilityLabel="VenU">
      Ven<Text style={styles.u}>U</Text>
    </Text>
  );
}

/**
 * The app mark: a white heart-handshake on an ink tile. Stands in for the gray logo placeholder
 * of the Figma sign-in screens (130pt there). Decorative: the title next to it names the screen.
 */
export function LogoMark({ size = 120 }: { size?: number }) {
  return (
    <View
      style={[styles.tile, { width: size, height: size, borderRadius: size * 0.24 }]}
      accessible={false}
      aria-hidden
      importantForAccessibility="no-hide-descendants">
      <Image source={require('@/assets/images/logo-heart.png')} style={{ width: size * 0.64, height: size * 0.64 }} contentFit="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { fontFamily: Fonts.displaySemiBold, color: Colors.primary },
  u: { color: Colors.accent },
  tile: { backgroundColor: Colors.ink, alignItems: 'center', justifyContent: 'center' },
});
