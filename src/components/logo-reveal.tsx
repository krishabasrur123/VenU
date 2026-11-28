/**
 * The VenU heart drawing itself (Figma "Logo • drawn-stroke reveal", 541:3687): each outline draws on
 * with a stroke-dash offset over LOGO_DRAW_MS, easing out, then the gradient fill fades in. `loop`
 * repeats it (draw, hold, fade, redraw) for a waiting screen. With Reduce Motion on, the finished logo
 * shows at once and stays still. `paused` stops the clock (a screen out of focus passes it, so a
 * hidden loop doesn't keep rendering); it starts over when unpaused. Decorative, like LogoMark: the
 * title beside it names the screen.
 * e.g. <LogoReveal size={100} /> on role choice; <LogoReveal size={140} loop paused={!focused} /> while searching.
 */
import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';

import { Colors } from '@/constants/theme';

import { LOGO_DONE, LOGO_REVEAL_MS, logoFrame, pathLength, type LogoFrame } from './logo-draw';
import { LOGO_HEART_OUTLINES, LOGO_HEART_PATH, LOGO_HEART_SIZE, LOGO_HEART_STROKE } from './logo-heart';

// Each outline's dash is its own length (a unit over, so no gap shows at the join).
const OUTLINE_LENGTHS = LOGO_HEART_OUTLINES.map(d => Math.ceil(pathLength(d)) + 1);
// While drawing, the outline is thicker than Figma's hairline so it reads without the fill.
const DRAW_STROKE = 1.4;
// One unit of room on each side, so the stroke isn't clipped at the viewBox edge.
const PAD = 1;
const VIEW_W = LOGO_HEART_SIZE.width + PAD * 2;
const VIEW_H = LOGO_HEART_SIZE.height + PAD * 2;
const NOTHING: LogoFrame = { draw: 0, fill: 0, opacity: 1 };

// Reduce Motion, read once for every logo on screen. One shared system listener: react-native-web
// keys 'reduceMotionChanged' handlers by their source text, so a listener per logo (all the same
// arrow function) would overwrite one another, and removing one would remove the other's.
let reduceMotion: boolean | null = null;
const reduceListeners = new Set<() => void>();
let reduceSub: { remove: () => void } | null = null;

function setReduceMotion(on: boolean) {
  if (reduceMotion === on) return;
  reduceMotion = on;
  reduceListeners.forEach(listener => listener());
}

function subscribeReduceMotion(listener: () => void) {
  reduceListeners.add(listener);
  if (!reduceSub) {
    reduceSub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    // Asked again on each first subscriber, in case it changed while no logo was listening.
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion, () => setReduceMotion(reduceMotion ?? false));
  }
  return () => {
    reduceListeners.delete(listener);
    if (!reduceListeners.size && reduceSub) {
      reduceSub.remove();
      reduceSub = null;
    }
  };
}

/** Whether Reduce Motion is on: null until the system first answers (a moment after mount). */
export function useReduceMotion(): boolean | null {
  return useSyncExternalStore(subscribeReduceMotion, () => reduceMotion, () => null);
}

/** The current frame, ticking on animation frames until the reveal ends (or forever with `loop`), unless paused. */
function useLogoFrame(loop: boolean, paused: boolean): LogoFrame {
  const reduce = useReduceMotion();
  const [frame, setFrame] = useState<LogoFrame>(NOTHING);
  useEffect(() => {
    if (reduce !== false || paused) return;
    let raf = 0;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const next = logoFrame(elapsed, loop);
      // Equal values keep the same object, so a held frame doesn't re-render.
      setFrame(prev => (prev.draw === next.draw && prev.fill === next.fill && prev.opacity === next.opacity ? prev : next));
      if (loop || elapsed < LOGO_REVEAL_MS) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce, loop, paused]);
  if (reduce) return LOGO_DONE;
  return frame;
}

export function LogoReveal({ size = 100, loop = false, paused = false }: { size?: number; loop?: boolean; paused?: boolean }) {
  // Gradient ids share one namespace on web, so each logo gets its own.
  const id = `logo-reveal-${useId().replace(/:/g, '')}`;
  const { draw, fill, opacity } = useLogoFrame(loop, paused);
  const height = (size * VIEW_H) / VIEW_W;
  const strokeWidth = DRAW_STROKE + (LOGO_HEART_STROKE - DRAW_STROKE) * fill;

  return (
    <View
      style={{ width: size, height }}
      accessible={false}
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      testID="logo-reveal">
      <Svg width={size} height={height} viewBox={`${-PAD} ${-PAD} ${VIEW_W} ${VIEW_H}`}>
        <Defs>
          {/* Figma's gradients run down the logo's own box: light blue at the top, navy at the point. */}
          <LinearGradient id={`${id}-fill`} gradientUnits="userSpaceOnUse" x1="51" y1="0.25" x2="51" y2="90.7">
            <Stop offset="0" stopColor={Colors.logoLight} />
            <Stop offset="1" stopColor={Colors.logoDeep} />
          </LinearGradient>
          <LinearGradient id={`${id}-stroke`} gradientUnits="userSpaceOnUse" x1="51" y1="0.25" x2="51" y2="90.7">
            <Stop offset="0" stopColor={Colors.primary} />
            <Stop offset="1" stopColor={Colors.logoDeep} />
          </LinearGradient>
        </Defs>
        <G opacity={opacity}>
          <Path d={LOGO_HEART_PATH} fill={`url(#${id}-fill)`} fillOpacity={fill} />
          {LOGO_HEART_OUTLINES.map((d, i) => {
            const length = OUTLINE_LENGTHS[i]!;
            return (
              <Path
                key={i}
                d={d}
                fill="none"
                stroke={`url(#${id}-stroke)`}
                strokeWidth={strokeWidth}
                strokeLinejoin="round"
                strokeDasharray={[length, length]}
                strokeDashoffset={length * (1 - draw)}
              />
            );
          })}
        </G>
      </Svg>
    </View>
  );
}
