/**
 * Icons for the six help types. Figma only draws the wheelchair (every card says "Physical
 * Assistance"), so the other five are drawn here in the same style: 32pt, 2.5 round strokes.
 */
import Svg, { Circle, Path } from 'react-native-svg';

import { FigmaIcon } from '@/components/icons/figma-icon';
import { Colors } from '@/constants/theme';
import type { HelpTypeId } from '@/features/volunteer/types';

const STROKE = { strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;

export function HelpIcon({ type, size = 32, color = Colors.ink }: { type: HelpTypeId; size?: number; color?: string }) {
  if (type === 'physical') return <FigmaIcon name="wheelchair-6dc801" size={size} color={color} />;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      {type === 'directions' && (
        <>
          <Path d="M16 4v24M11 28h10" stroke={color} {...STROKE} />
          <Path d="M7 6h14l4 3.5-4 3.5H7z" stroke={color} {...STROKE} />
          <Path d="M25 15H11l-4 3.5 4 3.5h14z" stroke={color} {...STROKE} />
        </>
      )}
      {type === 'language' && (
        <>
          <Path d="M4 5h15v11h-8l-4 3.5V16H4z" stroke={color} {...STROKE} />
          <Path d="M23 11h5v11h-3v3.5L21 22h-6v-3" stroke={color} {...STROKE} />
          <Path d="M8.5 13l3-6 3 6M9.5 11h4" stroke={color} {...STROKE} strokeWidth={2} />
        </>
      )}
      {type === 'quiet' && (
        <>
          <Path d="M6 20v-4a10 10 0 0 1 20 0v4" stroke={color} {...STROKE} />
          <Path d="M6 19h3.5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H8a2 2 0 0 1-2-2zM26 19h-3.5a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1H24a2 2 0 0 0 2-2z" stroke={color} {...STROKE} />
        </>
      )}
      {type === 'lost' && (
        <>
          <Circle cx="14" cy="14" r="8.5" stroke={color} {...STROKE} />
          <Path d="M20.5 20.5L27 27" stroke={color} {...STROKE} strokeWidth={3} />
          <Path d="M11.5 12a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.4" stroke={color} {...STROKE} strokeWidth={2} />
          <Circle cx="14" cy="18.6" r="1.1" fill={color} />
        </>
      )}
      {type === 'other' && (
        <>
          <Circle cx="16" cy="16" r="12" stroke={color} {...STROKE} />
          <Circle cx="10.5" cy="16" r="1.8" fill={color} />
          <Circle cx="16" cy="16" r="1.8" fill={color} />
          <Circle cx="21.5" cy="16" r="1.8" fill={color} />
        </>
      )}
    </Svg>
  );
}
