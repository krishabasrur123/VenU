/**
 * The venue map: the venue's published map image (or the schematic drawing) in a pan/zoom view the
 * app controls, with a pin per facility, the visitor's spot and a dashed route line on top.
 * Phones: drag, pinch, double-tap. Web: drag, mouse wheel, double-click, and the +/− buttons.
 * Pins keep their size at any zoom. The map is geographic, so it never mirrors in RTL.
 */
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { Button } from '@/components/button';
import { Colors, Face, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { useT } from '@/i18n';

import { FacilityIcon } from './categories';
import { startMarker, type Route } from './directions';
import { facilityName } from './labels';
import { clampView, contentSize, IMAGE_ZOOM_OUT_SLACK, isStrayPress, mapUpdate, zoomAt, ZOOM_STEP, zoomStep, type Box, type MapLayout, type MapRect, type MapView } from './map-geometry';
import { SPONSOR_ACCENT, SPONSOR_SOFT, SponsoredIcon } from './sponsor-ui';
import { VenueDrawing } from './stadium-map';
import type { Facility } from './types';
import { mapAspect, type VenueMap } from './venue-maps';

const PIN = 30;
const PIN_BIG = 40;
const HIT = 44;
/** The zoom buttons' column at the right edge. */
const HIT_BUTTONS = 44 + 8;
/** The source bar across the map's top edge. */
const SOURCE_BAR = 40;
const DOUBLE_TAP_ZOOM = 2;
const TIMING = { duration: 320 };
/** Fits keep pins below the source bar and left of the zoom buttons. */
const FIT_INSETS = { top: SOURCE_BAR + Spacing.sm, right: HIT_BUTTONS };
/** Room the bottom overlays (pin card, zoom buttons) keep clear above the sheet. */
export const MAP_CARD_SPACE = 104;

// Not in a StyleSheet: react-native-web rejects the `direction` style.
const NATIVE_LTR = Platform.OS === 'web' ? null : ({ direction: 'ltr' } as const);

export interface VenueMapViewProps {
  map: VenueMap;
  venueName: string;
  /** Pins to draw (already filtered by the chip). */
  pins: Facility[];
  /** The map area. */
  width: number;
  height: number;
  /** How much of the area, from the top, the sheet leaves visible. */
  viewportHeight: number;
  /** Pins drawn large and dark: the open facility, the card's, the route's end. */
  highlightIds: (string | null | undefined)[];
  /** Pins drawn in the chip colour. */
  tinted: boolean;
  route: Route | null;
  /** A new key fits `fitRect` into view (zoomed in no further than `fitMax`). */
  fitKey: string;
  fitRect: MapRect;
  fitMax: number;
  /** A pin to bring on screen if it's hidden (e.g. a facility opened from the list). */
  revealId?: string | null;
  /** Keep this much at the bottom of the viewport clear when revealing (the pin card). */
  revealInset?: number;
  onPinPress: (f: Facility) => void;
  /** Laid over the map's bottom edge, above the sheet (the pin card). */
  children?: ReactNode;
}

export function VenueMapView(props: VenueMapViewProps) {
  const { map, venueName, pins, width, height, viewportHeight, highlightIds, tinted, route, fitKey, fitRect: rect, fitMax, revealId, revealInset = 0, onPinPress, children } = props;
  const t = useT('venue');
  const content = contentSize(mapAspect(map), width, map.image ? IMAGE_ZOOM_OUT_SLACK : undefined);
  const viewport: Box = { w: width, h: Math.max(viewportHeight, 1) };
  // What gestures clamp to: while the pin card shows, the map may pan up clear of it.
  const reach: Box = { ...viewport, inset: revealInset };

  const s = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const dims = useSharedValue({ content, viewport: reach });
  // Whether the visitor moved the map since the last fit: then a sheet change keeps their view.
  const moved = useSharedValue(false);
  // A mouse drag that starts on a pin also clicks it on release: pins ignore presses during a pan.
  const panning = useSharedValue(false);
  const panEnd = useSharedValue(0);
  // A React copy of the scale, for line widths: updated when a gesture or animation ends.
  const [zoom, setZoom] = useState(1);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(map.image ? 'loading' : 'ready');
  const [attempt, setAttempt] = useState(0);

  const current = (): MapView => ({ s: s.get(), x: x.get(), y: y.get() });
  const go = (v: MapView, animate = true) => {
    s.set(animate ? withTiming(v.s, TIMING) : v.s);
    x.set(animate ? withTiming(v.x, TIMING) : v.x);
    y.set(animate ? withTiming(v.y, TIMING) : v.y);
    setZoom(v.s);
  };

  // Fit on a new key or a sheet move, then bring a newly revealed pin on screen (see mapUpdate).
  const last = useRef<MapLayout | null>(null);
  useEffect(() => {
    dims.set({ content, viewport: reach });
    const prev = last.current;
    const next: MapLayout = { key: fitKey, vh: viewport.h, w: width, reveal: revealId };
    last.current = next;
    const update = mapUpdate({
      prev,
      next,
      moved: moved.get(),
      view: current(),
      content,
      viewport,
      fit: { rect, max: fitMax, pad: 24, insets: FIT_INSETS },
      revealPin: revealId ? pins.find(f => f.id === revealId) : undefined,
      revealInset,
    });
    if (!update) {
      // A closed card gives the map its bottom strip back: bring the image's edge down to it.
      const now = current();
      const v = clampView(now, content, reach);
      if (prev && (v.x !== now.x || v.y !== now.y)) go(v);
      return;
    }
    if (update.refit) moved.set(false);
    go(update.view, !!prev);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs on these inputs only; the rest is read fresh
  }, [fitKey, viewport.h, width, revealId, revealInset]);

  const pressPin = (f: Facility) => {
    if (isStrayPress(Date.now(), panEnd.get(), panning.get())) return;
    onPinPress(f);
  };

  // Clamped like the gestures (reach), so a pin lifted clear of the card stays clear.
  const zoomBy = (factor: number) => {
    moved.set(true);
    go(zoomStep(current(), factor, content, reach));
  };

  const pan = usePanGesture({
    minDistance: 6,
    onActivate: () => {
      'worklet';
      panning.set(true);
    },
    onDeactivate: () => {
      'worklet';
      panning.set(false);
      panEnd.set(Date.now());
    },
    onUpdate: e => {
      'worklet';
      const d = dims.get();
      const v = clampView({ s: s.get(), x: x.get() + e.changeX, y: y.get() + e.changeY }, d.content, d.viewport);
      moved.set(true);
      x.set(v.x);
      y.set(v.y);
    },
  });

  const pinch = usePinchGesture({
    onUpdate: e => {
      'worklet';
      const d = dims.get();
      const v = zoomAt({ s: s.get(), x: x.get(), y: y.get() }, e.scaleChange, { x: e.focalX, y: e.focalY }, d.content, d.viewport);
      moved.set(true);
      s.set(v.s);
      x.set(v.x);
      y.set(v.y);
    },
    onDeactivate: () => {
      'worklet';
      scheduleOnRN(setZoom, s.get());
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onActivate: e => {
      'worklet';
      const d = dims.get();
      const v = zoomAt({ s: s.get(), x: x.get(), y: y.get() }, DOUBLE_TAP_ZOOM, { x: e.x, y: e.y }, d.content, d.viewport);
      moved.set(true);
      s.set(withTiming(v.s, TIMING));
      x.set(withTiming(v.x, TIMING));
      y.set(withTiming(v.y, TIMING));
      scheduleOnRN(setZoom, v.s);
    },
  });

  const gestures = useSimultaneousGestures(pan, pinch, doubleTap);

  // Web: the mouse wheel (and a trackpad pinch, which arrives as ctrl+wheel) zooms at the pointer.
  const frame = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = frame.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const box = node.getBoundingClientRect();
      const d = dims.get();
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      const v = zoomAt({ s: s.get(), x: x.get(), y: y.get() }, factor, { x: e.clientX - box.left, y: e.clientY - box.top }, d.content, d.viewport);
      moved.set(true);
      s.set(v.s);
      x.set(v.x);
      y.set(v.y);
      clearTimeout(settle);
      settle = setTimeout(() => setZoom(v.s), 120);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      node.removeEventListener('wheel', onWheel);
      clearTimeout(settle);
    };
  }, [dims, moved, s, x, y]);

  const contentStyle = useAnimatedStyle(() => {
    const { w, h } = dims.get().content;
    const k = s.get();
    return { transform: [{ translateX: x.get() + ((k - 1) * w) / 2 }, { translateY: y.get() + ((k - 1) * h) / 2 }, { scale: k }] };
  });
  // Undoes the map's zoom on each pin, so pins stay one size.
  const counterScale = useAnimatedStyle(() => ({ transform: [{ scale: 1 / s.get() }] }));

  const highlighted = new Set(highlightIds.filter(Boolean));
  const start = startMarker(route);
  const youId = start?.kind === 'you' ? start.at.id : null;
  const scaleLine = (n: number) => n / Math.max(zoom, 0.1);
  // The dashed line from the visitor's spot to the facility, in content px.
  const line = route && !route.here
    ? { x1: route.from.x * content.w, y1: route.from.y * content.h, x2: route.to.x * content.w, y2: route.to.y * content.h }
    : null;

  return (
    <View style={[styles.root, NATIVE_LTR, { width, height }]}>
      <GestureDetector gesture={gestures}>
        <View ref={frame} style={StyleSheet.absoluteFill} accessible accessibilityRole="image" accessibilityLabel={t('map.label', { venue: venueName })}>
          <Animated.View style={[styles.content, { width: content.w, height: content.h }, contentStyle]}>
            {map.image ? (
              // Not a target: on web the <img> would start the browser's image drag instead of a pan.
              <View style={[styles.passThrough, { width: content.w, height: content.h }]}>
                <Image
                  key={attempt}
                  source={{ uri: map.image.url, width: map.image.width, height: map.image.height }}
                  style={{ width: content.w, height: content.h }}
                  contentFit="fill"
                  transition={150}
                  onLoad={() => setStatus('ready')}
                  onError={() => setStatus('error')}
                  accessible={false}
                />
              </View>
            ) : (
              <VenueDrawing shape={map.shape} width={content.w} height={content.h} />
            )}
            {line ? (
              <Svg width={content.w} height={content.h} style={StyleSheet.absoluteFill} pointerEvents="none" aria-hidden>
                <Line {...line} stroke={Colors.surface} strokeWidth={scaleLine(9)} strokeLinecap="round" />
                <Line {...line} stroke={Colors.primary} strokeWidth={scaleLine(5)} strokeDasharray={`${scaleLine(10)} ${scaleLine(7)}`} />
              </Svg>
            ) : null}
            {pins.map(f => (
              <Pin
                key={f.id}
                facility={f}
                left={f.x * content.w}
                top={f.y * content.h}
                counterScale={counterScale}
                big={highlighted.has(f.id)}
                tinted={tinted}
                hidden={f.id === youId}
                onPress={pressPin}
              />
            ))}
            {start?.kind === 'you' ? <YouMarker left={start.at.x * content.w} top={start.at.y * content.h} counterScale={counterScale} label={t('map.you')} /> : null}
            {start?.kind === 'start' ? <StartTag left={start.at.x * content.w} top={start.at.y * content.h} counterScale={counterScale} label={t('map.start')} /> : null}
          </Animated.View>
        </View>
      </GestureDetector>

      {status !== 'ready' ? (
        <View style={[styles.cover, { height: viewport.h }]} pointerEvents={status === 'error' ? 'auto' : 'none'} accessibilityLiveRegion="polite">
          {status === 'loading' ? <ActivityIndicator size="large" color={Colors.primary} /> : (
            <>
              <Text style={styles.coverText} accessibilityRole="alert">{t('officialMap.error')}</Text>
              <Button label={t('officialMap.retry')} onPress={() => { setStatus('loading'); setAttempt(a => a + 1); }} />
            </>
          )}
        </View>
      ) : null}

      <SourceBar map={map} />

      <View style={[styles.zoomButtons, { top: Math.max(viewport.h - MAP_CARD_SPACE - 2 * HIT - Spacing.sm, SOURCE_BAR + Spacing.sm) }]} pointerEvents="box-none">
        <ZoomButton glyph="+" label={t('officialMap.zoomIn')} onPress={() => zoomBy(ZOOM_STEP)} />
        <ZoomButton glyph="−" label={t('officialMap.zoomOut')} onPress={() => zoomBy(1 / ZOOM_STEP)} />
      </View>


      <View style={[styles.bottom, { top: Math.max(viewport.h - MAP_CARD_SPACE, 0), height: MAP_CARD_SPACE }]} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}

function Pin({ facility, left, top, counterScale, big, tinted, hidden, onPress }: {
  facility: Facility;
  left: number;
  top: number;
  counterScale: ReturnType<typeof useAnimatedStyle>;
  big: boolean;
  tinted: boolean;
  hidden: boolean;
  onPress: (f: Facility) => void;
}) {
  const t = useT('venue');
  if (hidden) return null;
  const size = big ? PIN_BIG : PIN;
  const filled = big || tinted;
  // A sponsored stand: the Sponsored glyph in the sponsor accent, so it never reads as a venue facility.
  const sponsored = !!facility.sponsor;
  const fill = sponsored ? (filled ? SPONSOR_ACCENT : SPONSOR_SOFT) : big ? Colors.inkDeep : tinted ? Colors.primary : Colors.surface;
  const name = facilityName(facility, t);
  return (
    <Animated.View style={[styles.pinBox, { left: left - HIT / 2, top: top - HIT / 2 }, big && styles.onTop, counterScale]}>
      <Pressable
        onPress={() => onPress(facility)}
        style={styles.hit}
        accessibilityRole="button"
        accessibilityLabel={sponsored ? t('sponsor.pin', { name }) : t('map.pin', { name })}
        accessibilityState={{ selected: big }}>
        <View style={[styles.pin, { width: size, height: size, borderRadius: size / 2, backgroundColor: fill }, filled && styles.pinFilled, sponsored && !filled && styles.pinSponsored, big && styles.pinBig]}>
          {sponsored
            ? <SponsoredIcon size={big ? 24 : 19} color={filled ? Colors.onPrimary : SPONSOR_ACCENT} background={fill} />
            : <FacilityIcon category={facility.category} size={big ? 22 : 17} color={filled ? Colors.onPrimary : Colors.ink} background={fill} />}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function YouMarker({ left, top, counterScale, label }: { left: number; top: number; counterScale: ReturnType<typeof useAnimatedStyle>; label: string }) {
  return (
    <Animated.View style={[styles.pinBox, styles.onTop, { left: left - HIT / 2, top: top - HIT / 2 }, counterScale]} pointerEvents="none">
      <View style={styles.youHalo} />
      <View style={styles.youDot} />
      <Text style={styles.youLabel} numberOfLines={1}>{label}</Text>
    </Animated.View>
  );
}

/** A "Start" tag under the pin where a walk starts (the venue's way in, still tappable). */
function StartTag({ left, top, counterScale, label }: { left: number; top: number; counterScale: ReturnType<typeof useAnimatedStyle>; label: string }) {
  return (
    <Animated.View style={[styles.pinBox, styles.onTop, { left: left - HIT / 2, top: top - HIT / 2 }, counterScale]} pointerEvents="none">
      <Text style={[styles.youLabel, styles.startLabel]} numberOfLines={1}>{label}</Text>
    </Animated.View>
  );
}

/** "Map: SoFi Stadium · Open interactive map" over the top of the map. */
function SourceBar({ map }: { map: VenueMap }) {
  const t = useT('venue');
  const pageUrl = map.pageUrl;
  return (
    <View style={styles.sourceBar} pointerEvents="box-none">
      <Text style={styles.source} numberOfLines={1}>
        {map.image ? t('officialMap.attribution', { source: map.source }) : t('officialMap.schematic')}
      </Text>
      {pageUrl ? (
        <Pressable
          onPress={() => { WebBrowser.openBrowserAsync(pageUrl).catch(() => {}); }}
          hitSlop={8}
          style={({ pressed }) => [styles.openLink, pressed && styles.pressed]}
          accessibilityRole="link"
          accessibilityLabel={t('officialMap.openLabel', { source: map.source })}>
          <Text style={styles.openText} numberOfLines={1}>{t('officialMap.openInteractive')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ZoomButton({ glyph, label, onPress }: { glyph: string; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.zoom, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={styles.zoomGlyph}>{glyph}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { overflow: 'hidden' },
  content: { position: 'absolute', left: 0, top: 0 },
  passThrough: { pointerEvents: 'none', userSelect: 'none' },
  pinBox: { position: 'absolute', width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
  hit: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
  onTop: { zIndex: 2 },
  pin: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.ink, ...Shadow.card },
  pinFilled: { borderColor: Colors.surface, borderWidth: 2 },
  pinSponsored: { borderColor: SPONSOR_ACCENT, borderWidth: 2 },
  pinBig: { borderWidth: 3 },
  youHalo: { position: 'absolute', width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, opacity: 0.22 },
  youDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.primary, borderWidth: 3, borderColor: Colors.surface, ...Shadow.card },
  youLabel: {
    position: 'absolute',
    top: HIT - 6,
    ...Face.textBold,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.onPrimary,
    backgroundColor: Colors.primary,
    paddingHorizontal: 6,
    borderRadius: 6,
    overflow: 'hidden',
  },
  startLabel: { top: HIT - 4, backgroundColor: Colors.inkDeep },
  sourceBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: SOURCE_BAR,
    paddingHorizontal: Spacing.gutter,
    // Solid, so a pin panned under the bar is hidden instead of showing through its text.
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  source: { flex: 1, fontFamily: Fonts.text, fontSize: 13, lineHeight: 17, color: Colors.textMuted },
  openLink: { minHeight: 36, justifyContent: 'center' },
  openText: { ...Face.textBold, fontSize: 13, lineHeight: 17, color: Colors.primary, textDecorationLine: 'underline' },
  pressed: { opacity: 0.6 },
  zoomButtons: { position: 'absolute', right: Spacing.sm, gap: Spacing.sm },
  zoom: {
    width: HIT,
    height: HIT,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
  },
  zoomGlyph: { ...Face.displayMedium, fontSize: 24, lineHeight: 28, color: Colors.ink },
  cover: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xl, backgroundColor: Colors.surfaceAlt },
  coverText: { fontFamily: Fonts.display, fontSize: 15, lineHeight: 20, textAlign: 'center', color: Colors.textMuted },
  bottom: { position: 'absolute', left: 0, right: 0, justifyContent: 'flex-end', paddingHorizontal: Spacing.gutter, paddingBottom: Spacing.md },
});
