/**
 * The Figma page background (Find a Volunteer 506:9816, Onboarding 2.0): cream at the top fading
 * to light blue at the bottom. `shapes` adds the soft blurred blue shapes of the onboarding frames
 * (role choice 530:10212, preferences 506:10114). Fills its parent behind the content, e.g.
 * <SafeAreaView style={{ flex: 1 }}><PageGradient shapes /><ScrollView>…</ScrollView></SafeAreaView>
 */
import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Colors } from '@/constants/theme';

/**
 * The shapes in Figma's 440x956 frame: a big haze on the right, two leaves low down.
 * Each fades out from its middle, standing in for Figma's layer blur.
 */
const SHAPES = [
  { cx: 420, cy: 470, rx: 150, ry: 210, rotate: -20, opacity: 0.55 },
  { cx: 205, cy: 725, rx: 75, ry: 34, rotate: 18, opacity: 0.7 },
  { cx: 85, cy: 780, rx: 34, ry: 85, rotate: 22, opacity: 0.6 },
] as const;

export function PageGradient({ shapes = false }: { shapes?: boolean }) {
  // Each gradient needs a page-unique id on web, where every SVG shares one id namespace.
  const id = `page-gradient-${useId().replace(/:/g, '')}`;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" preserveAspectRatio="none" aria-hidden>
        <Defs>
          <LinearGradient id={id} x1={0} y1={0} x2={0} y2={1}>
            <Stop offset={0} stopColor={Colors.gradientTop} />
            <Stop offset={0.66} stopColor={Colors.gradientMid} />
            <Stop offset={0.91} stopColor={Colors.gradientBottom} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      {shapes ? (
        // Scaled like the Figma frame, anchored to the bottom so the leaves stay near the button.
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 440 956" preserveAspectRatio="xMidYMax slice" aria-hidden>
          <Defs>
            <RadialGradient id={`${id}-shape`} cx="50%" cy="50%" r="50%">
              <Stop offset={0} stopColor={Colors.gradientShape} stopOpacity={1} />
              <Stop offset={0.55} stopColor={Colors.gradientShape} stopOpacity={0.55} />
              <Stop offset={1} stopColor={Colors.gradientShape} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          {SHAPES.map((s, i) => (
            <Ellipse
              key={i}
              cx={s.cx}
              cy={s.cy}
              rx={s.rx}
              ry={s.ry}
              transform={`rotate(${s.rotate} ${s.cx} ${s.cy})`}
              fill={`url(#${id}-shape)`}
              opacity={s.opacity}
            />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}
