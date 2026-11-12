/**
 * One venue: header with category chips, the stadium map, and the "Facility Search" bottom sheet.
 * The sheet snaps to three heights (down / mid / up) by dragging or tapping its handle; its content
 * is the current child route (facility list, facility card, report, add report).
 */
import { router, Slot, useGlobalSearchParams } from 'expo-router';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent, type ScrollViewProps } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { NAV_BAR_CLEARANCE } from '@/components/tab-bar';
import { Colors, Shadow, Spacing } from '@/constants/theme';
import { useT } from '@/i18n';

import { CategoryChips } from './category-chips';
import { facilitiesFor } from './mock';
import { MAP_BACKGROUND, SHEET_HANDLE, StadiumMap } from './stadium-map';
import type { Facility, FacilityCategory, Venue } from './types';
import { BackArrow, venueText } from './ui';

export type SheetSnap = 'down' | 'mid' | 'up';

interface VenueScreenState {
  venue: Venue;
  facilities: Facility[];
  category: FacilityCategory | null;
  setCategory: (c: FacilityCategory | null) => void;
  snap: SheetSnap;
  setSnap: (s: SheetSnap) => void;
  /** Bottom padding sheet content needs so its end clears the tab bar at the current height. */
  contentInset: number;
  /** The report just submitted here, highlighted as "New" until the user leaves its facility. */
  freshReport: FreshReport | null;
  setFreshReport: (r: FreshReport | null) => void;
}

export interface FreshReport {
  venueId: string;
  facilityId: string;
  reportId: string;
}

const VenueScreenContext = createContext<VenueScreenState | null>(null);

export function useVenueScreen(): VenueScreenState {
  const ctx = use(VenueScreenContext);
  if (!ctx) throw new Error('useVenueScreen outside VenueMapScreen');
  return ctx;
}

/** Scroll view for sheet content: pads the bottom so the last item clears the tab bar. */
export function SheetScroll({ children, contentContainerStyle, ...rest }: ScrollViewProps & { children: ReactNode }) {
  const { contentInset } = useVenueScreen();
  return (
    <ScrollView
      {...rest}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.sheetContent, contentContainerStyle, { paddingBottom: contentInset }]}>
      {children}
    </ScrollView>
  );
}

/** Raised sheet's gap below the header, and how much of the lowered sheet shows above the tab bar. */
const UP_GAP = 48;
const PEEK = 132;
const NEXT: Record<SheetSnap, SheetSnap> = { down: 'mid', mid: 'up', up: 'down' };
const SNAP_NAMES: SheetSnap[] = ['up', 'mid', 'down'];
const SPRING = { damping: 26, stiffness: 260, mass: 0.9 };

/** Sheet tops for each snap, in the map area's coordinates, for a map area `h` tall. */
function snapPositions(h: number, tabClearance: number): Record<SheetSnap, number> {
  const down = Math.max(h - PEEK - tabClearance, UP_GAP);
  return { up: UP_GAP, mid: Math.min(Math.round(h * 0.5), down), down };
}

export function VenueMapScreen({ venue }: { venue: Venue }) {
  const t = useT('venue');
  const insets = useSafeAreaInsets();
  const { facilityId } = useGlobalSearchParams<{ facilityId?: string }>();
  const facilities = useMemo(() => facilitiesFor(venue.id), [venue.id]);
  const [category, setCategory] = useState<FacilityCategory | null>(null);
  const [snap, setSnap] = useState<SheetSnap>('mid');
  const [box, setBox] = useState({ w: 0, h: 0 });
  // Set by the facility card after a submit; the list and other facilities clear it.
  const [freshReport, setFreshReport] = useState<FreshReport | null>(null);

  const tabClearance = NAV_BAR_CLEARANCE - 24 + Math.max(insets.bottom, 0);
  const positions = useMemo(() => snapPositions(box.h, tabClearance), [box.h, tabClearance]);

  // Sheet top, in the map area's coordinates.
  const top = useSharedValue(0);
  const snaps = useSharedValue([positions.up, positions.mid, positions.down]);
  const start = useSharedValue(0);

  // Later snap or size changes spring there. The first placement happens in onAreaLayout instead.
  useEffect(() => {
    if (!box.h) return;
    snaps.set([positions.up, positions.mid, positions.down]);
    top.set(withSpring(positions[snap], SPRING));
  }, [box.h, positions, snap, snaps, top]);

  // The sheet only renders once the map area has a size. On that first layout, put it straight at
  // its snap, so it doesn't spring down over the map from the top on every visit.
  const onAreaLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (!box.w) {
      const p = snapPositions(h, tabClearance);
      snaps.set([p.up, p.mid, p.down]);
      top.set(p[snap]);
    }
    setBox({ w, h });
  };

  // A drag that ends over the handle also reads as a tap on web; ignore that tap.
  const lastDrag = useRef(0);
  const markDragged = useCallback(() => { lastDrag.current = Date.now(); }, []);
  const tapHandle = () => {
    if (Date.now() - lastDrag.current < 600) return;
    setSnap(NEXT[snap]);
  };

  const pan = usePanGesture({
    minDistance: 4,
    onBegin: () => {
      'worklet';
      start.set(top.get());
    },
    onActivate: () => {
      'worklet';
      scheduleOnRN(markDragged);
    },
    onUpdate: e => {
      'worklet';
      const [up, , down] = snaps.get();
      top.set(Math.min(Math.max(start.get() + e.translationY, up - 20), down + 20));
    },
    onDeactivate: e => {
      'worklet';
      // Aim where a flick would carry the sheet, then take the nearest stop.
      const projected = top.get() + e.velocityY * 0.15;
      let best = 0;
      for (let i = 1; i < 3; i++) if (Math.abs(snaps.get()[i] - projected) < Math.abs(snaps.get()[best] - projected)) best = i;
      top.set(withSpring(snaps.get()[best], SPRING));
      scheduleOnRN(markDragged);
      scheduleOnRN(setSnap, SNAP_NAMES[best]);
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: top.get() }] }));
  // Keep the stadium centred in the strip of map above the sheet.
  const mapStyle = useAnimatedStyle(() => ({ transform: [{ translateY: Math.min((top.get() - snaps.get()[2]) / 2, 0) }] }));

  const pickCategory = useCallback((c: FacilityCategory | null) => {
    setCategory(c);
    setSnap(s => (s === 'up' ? 'mid' : s)); // show the highlighted pins
  }, []);

  const openFromMap = useCallback((f: Facility) => {
    setSnap('mid');
    router.navigate({ pathname: '/venue/[venueId]/[facilityId]', params: { venueId: venue.id, facilityId: f.id } });
  }, [venue.id]);

  const sheetHeight = Math.max(box.h - positions.up, 0);
  const ctx: VenueScreenState = {
    venue,
    facilities,
    category,
    setCategory: pickCategory,
    snap,
    setSnap,
    contentInset: positions[snap] - positions.up + tabClearance + Spacing.xl,
    freshReport,
    setFreshReport,
  };

  return (
    <GestureHandlerRootView style={styles.root}>
      <VenueScreenContext value={ctx}>
        <SafeAreaView edges={['top']} style={styles.header}>
          <View style={styles.titleRow}>
            <BackArrow onPress={() => router.navigate('/venue')} label={t('back.venues')} />
            <View style={styles.titleText}>
              <Text style={venueText.title} accessibilityRole="header" numberOfLines={2}>{venue.name}</Text>
              <Text style={venueText.caption} numberOfLines={1}>{venue.address}</Text>
            </View>
          </View>
          <CategoryChips value={category} onChange={pickCategory} />
        </SafeAreaView>

        <View style={styles.area} onLayout={onAreaLayout}>
          {box.w > 0 ? (
            <>
              <Animated.View style={[styles.map, mapStyle]}>
                <StadiumMap
                  shape={venue.shape}
                  facilities={facilities}
                  width={box.w}
                  height={positions.down}
                  category={category}
                  selectedId={facilityId}
                  onPinPress={openFromMap}
                />
              </Animated.View>

              <Animated.View style={[styles.sheet, { height: sheetHeight }, sheetStyle]}>
                <GestureDetector gesture={pan}>
                  <View style={styles.handleZone}>
                    <Pressable
                      onPress={tapHandle}
                      style={styles.handleTarget}
                      accessibilityRole="adjustable"
                      accessibilityLabel={t(`sheet.${snap}`)}
                      accessibilityHint={t('sheet.hint')}
                      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                      onAccessibilityAction={e => setSnap(s => (e.nativeEvent.actionName === 'increment' ? (s === 'down' ? 'mid' : 'up') : s === 'up' ? 'mid' : 'down'))}>
                      <View style={styles.handle} />
                    </Pressable>
                  </View>
                </GestureDetector>
                <View style={styles.sheetBody}>
                  <Slot />
                </View>
              </Animated.View>
            </>
          ) : null}
        </View>
      </VenueScreenContext>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: Colors.bg, zIndex: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.gutter, paddingTop: Spacing.md },
  titleText: { flex: 1, gap: 4 },
  area: { flex: 1, overflow: 'hidden', backgroundColor: MAP_BACKGROUND, borderTopLeftRadius: 10, borderTopRightRadius: 10 },
  map: { position: 'absolute', left: 0, right: 0, top: 0 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    ...Shadow.float,
    shadowOffset: { width: 0, height: -2 },
  },
  handleZone: { alignItems: 'center' },
  handleTarget: { width: '100%', height: 32, alignItems: 'center', justifyContent: 'center', cursor: 'grab' } as object,
  handle: { width: 102, height: 4, borderRadius: 2, backgroundColor: SHEET_HANDLE },
  sheetBody: { flex: 1 },
  sheetContent: { paddingHorizontal: Spacing.gutter, paddingTop: 4 },
});
