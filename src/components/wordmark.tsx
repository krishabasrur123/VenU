import { useId, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { FIGMA_ICONS } from '@/components/icons/figma-icons';
import { Colors, Face } from '@/constants/theme';

/** "VenU" with the blue "Ven" and orange "U" from the mockups. */
export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <Text style={[styles.base, { fontSize: size, letterSpacing: size > 30 ? -1 : -0.3 }]} accessibilityRole="header" accessibilityLabel="VenU">
      Ven<Text style={styles.u}>U</Text>
    </Text>
  );
}

/** The heart-handshake outline (Figma "volunteer icon", 52x46), the shape of the VenU logo. */
const HEART = FIGMA_ICONS.volunteer;
const HEART_RATIO = 46 / 52;

/**
 * The VenU logo (Figma "Logo" 482:31930, on role choice 530:10212): the heart-handshake outline,
 * light blue at the top shading to navy at the point. `size` is its width. Decorative: the
 * "VenU" title next to it names the screen. e.g. <LogoMark size={100} />
 */
export function LogoMark({ size = 100 }: { size?: number }) {
  // Gradient ids share one namespace on web, so each logo gets its own.
  const id = `logo-${useId().replace(/:/g, '')}`;
  const xml = useMemo(
    () =>
      HEART.replace(/(fill|stroke)="currentColor"/g, `$1="url(#${id})"`).replace(
        /(<svg[^>]*>)/,
        `$1<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">` +
          `<stop offset="0" stop-color="${Colors.logoLight}"/><stop offset="1" stop-color="${Colors.logoDeep}"/>` +
          '</linearGradient></defs>',
      ),
    [id],
  );
  return (
    <View
      style={{ width: size, height: size * HEART_RATIO }}
      accessible={false}
      aria-hidden
      importantForAccessibility="no-hide-descendants">
      <SvgXml xml={xml} width={size} height={size * HEART_RATIO} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { ...Face.displaySemiBold, color: Colors.primary },
  u: { color: Colors.accent },
});
