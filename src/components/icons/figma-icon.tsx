import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { Colors } from '@/constants/theme';

import { FIGMA_ICONS, type FigmaIconName } from './figma-icons';

export type { FigmaIconName };

interface FigmaIconProps {
  name: FigmaIconName;
  /** Width in points; height follows the icon's own aspect ratio. Omit for the Figma size. */
  size?: number;
  /** Recolors one-color icons; multi-color icons keep their Figma colors. */
  color?: string;
  /** Omit for decorative icons next to a text label (they're hidden from screen readers). */
  accessibilityLabel?: string;
}

/** An icon exported from the VenU Figma file: `<FigmaIcon name="alert-triangle" size={24} />`. */
export function FigmaIcon({ name, size, color = Colors.ink, accessibilityLabel }: FigmaIconProps) {
  const xml = FIGMA_ICONS[name];
  const m = /width="([\d.]+)" height="([\d.]+)"/.exec(xml);
  const w = m ? Number(m[1]) : 24;
  const h = m ? Number(m[2]) : 24;
  const width = size ?? w;
  const height = size ? (size * h) / w : h;
  // Accessibility props live on the wrapper: SvgXml forwards unknown props to the DOM on web.
  return (
    <View
      style={{ width, height }}
      role={accessibilityLabel ? 'img' : undefined}
      aria-label={accessibilityLabel}
      aria-hidden={!accessibilityLabel}>
      <SvgXml xml={xml} width={width} height={height} color={color} />
    </View>
  );
}
