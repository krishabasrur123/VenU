/**
 * One venue: header with category chips, the map, and the "Facility Search" bottom sheet.
 * The map is the venue's own published map image where it has one (./venue-maps.ts), else the
 * schematic drawing, with a pin per facility; a chip filters the pins and the sheet's list alike.
 * The sheet snaps to three heights (down / mid / up) by dragging or tapping its handle; its content
 * is the current child route (facility list, facility card, report, add report).
 */
import { router, Slot, useGlobalSearchParams } from 'expo-router';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent, type ScrollViewProps } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { NAV_BAR_CLEARANCE } from '@/components/tab-bar';
import { Colors, Shadow, Spacing } from '@/constants/theme';
import { useT } from '@/i18n';

import { categoriesAt } from './categories';
import { CategoryChips } from './category-chips';
import { useWhereAmI } from './current';
import { routeFor, routeStart, walkFrom, type Route } from './directions';
import type { FacilityWalk } from './labels';
import { boundsOf, FIT_MAX_SCALE, MAX_SCALE, pinsFor, type MapRect } from './map-geometry';
import { PinCard } from './pin-card';
import { pinPressAction } from './pin-press';
import { snapPositions, type SheetSnap } from './sheet';
import { venueFacilitiesFor } from './sponsors';
import { MAP_BACKGROUND, SHEET_HANDLE } from './stadium-map';
import type { Facility, FacilityCategory, Venue } from './types';
import { BackArrow, venueText } from './ui';
import { venueMapFor, type VenueMap } from './venue-maps';
import { MAP_CARD_SPACE, VenueMapView } from './venue-map-view';

export type { SheetSnap };

interface VenueScreenState {
  venue: Venue;
  map: VenueMap;
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
  /** The route drawn on the map, to the open facility (null when none or after leaving it). */
  route: Route | null;
  /** Directions to a facility (the open one), or null to end them. */
  setRouteTo: (facilityId: string | null) => void;
  /** How far a facility is from where walks start, in the same minutes the route panel shows. */
  walkTo: (f: Facility) => FacilityWalk | null;
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
export function SheetScroll({ children, contentContainerStyle, scrollRef, ...rest }: ScrollViewProps & {
  children: ReactNode;
  /** For scrolling the sheet to a part of its content (the directions). */
  scrollRef?: Ref<ComponentRef<typeof ScrollView>>;
}) {
  const { contentInset } = useVenueScreen();
  return (
    <ScrollView
      {...rest}
      ref={scrollRef}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.sheetContent, contentContainerStyle, { paddingBottom: contentInset }]}>
      {children}
    </ScrollView>
  );
}

const NEXT: Record<SheetSnap, SheetSnap> = { down: 'mid', mid: 'up', up: 'down' };
const SNAP_NAMES: SheetSnap[] = ['up', 'mid', 'down'];
const SPRING = { damping: 26, stiffness: 260, mass: 0.9 };

export function VenueMapScreen({ venue }: { venue: Venue }) {
  const t = useT('venue');
  const insets = useSafeAreaInsets();
  const { facilityId } = useGlobalSearchParams<{ facilityId?: string }>();
  // The venue's facilities and its sponsored stands (./sponsors.ts).
  const facilities = useMemo(() => venueFacilitiesFor(venue.id), [venue.id]);
  const map = venueMapFor(venue); // the same object per venue
  const [category, setCategory] = useState<FacilityCategory | null>(null);
  // Start low, so most of the map shows; the map fits its view into the part the sheet leaves.
  // Opening a facility or searching raises it to mid. Chosen once per mount (the route keys this
  // screen by venue, so a new venue starts low again).
  const [snap, setSnap] = useState<SheetSnap>('down');
  const [box, setBox] = useState({ w: 0, h: 0 });
  // Set by the facility card after a submit; the list and other facilities clear it.
  const [freshReport, setFreshReport] = useState<FreshReport | null>(null);
  // The pin whose photo card shows over the map. It belongs to the facility open when it was
  // tapped: opening another one (from the list, a deep link) drops it.
  const [cardState, setCardState] = useState<{ id: string; at: string | undefined } | null>(null);
  const cardId = cardState && cardState.at === facilityId ? cardState.id : null;
  const setCardId = (id: string | null) => setCardState(id ? { id, at: facilityId } : null);
  // Directions shown for a facility. They last while it stays open in the sheet, so backing out to
  // the list or opening another facility ends them.
  const [routeTo, setRouteState] = useState<string | null>(null);
  const where = useWhereAmI();
  const route = routeTo && routeTo === facilityId ? routeFor(map, facilities, where, venue.id, routeTo) : null;
  const setRouteTo = (id: string | null) => {
    setRouteState(id);
    if (id) setCardState(null);
  };
  // Where walks start, found once per render: the list measures every facility from it.
  const walkStart = routeStart(map, facilities, where, venue.id);
  const walkTo = (f: Facility) => walkFrom(map, walkStart, f);

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

  const pickCategory = (c: FacilityCategory | null) => {
    setCategory(c);
    setCardState(null);
    // The chip's pins need the map in view.
    setSnap(s => (s === 'up' ? 'mid' : s));
  };


  // Pins for the chip (the open facility always stays), and what the map fits into view: the
  // chip's pins, or the venue's own starting region for "All".
  const pins = pinsFor(facilities, category, [facilityId, cardId, route?.from.id, route?.to.id]);
  const card = cardId ? facilities.find(f => f.id === cardId) : undefined;
  const chipBounds = category ? boundsOf(pinsFor(facilities, category)) : null;
  // A route wins: both its ends in view above the sheet.
  const fit: { key: string; rect: MapRect; max: number } = route
    ? { key: `route:${route.from.id}>${route.to.id}`, rect: boundsOf([route.from, route.to])!, max: FIT_MAX_SCALE }
    : chipBounds
      ? { key: `chip:${category}`, rect: chipBounds, max: FIT_MAX_SCALE }
      : { key: 'focus', rect: map.focus, max: MAX_SCALE };

  // From the list, a pin shows its card and the card opens the facility in the sheet. With a
  // facility open, another pin opens straight away (./pin-press.ts).
  const pressPin = (f: Facility) => {
    const action = pinPressAction(facilityId, f.id);
    if (action === 'open') openFacility(f);
    if (action !== 'card') return;
    setCardId(f.id);
    setSnap(s => (s === 'up' ? 'mid' : s)); // room above the sheet for the card
  };
  const openFacility = (f: Facility) => {
    setCardId(null);
    setSnap('mid');
    router.navigate({ pathname: '/venue/[venueId]/[facilityId]', params: { venueId: venue.id, facilityId: f.id } });
  };

  const sheetHeight = Math.max(box.h - positions.up, 0);
  const ctx: VenueScreenState = {
    venue,
    map,
    facilities,
    category,
    setCategory: pickCategory,
    snap,
    setSnap,
    contentInset: positions[snap] - positions.up + tabClearance + Spacing.xl,
    freshReport,
    setFreshReport,
    route,
    setRouteTo,
    walkTo,
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
          <CategoryChips value={category} onChange={pickCategory} categories={categoriesAt(facilities, category)} />
        </SafeAreaView>

        <View style={[styles.area, map.image && styles.areaImage, map.background ? { backgroundColor: map.background } : null]} onLayout={onAreaLayout}>
          {box.w > 0 ? (
            <>
              <VenueMapView
                map={map}
                venueName={venue.name}
                pins={pins}
                width={box.w}
                height={box.h}
                viewportHeight={positions[snap]}
                highlightIds={[facilityId, cardId, route?.to.id]}
                tinted={!!category}
                route={route}
                fitKey={fit.key}
                fitRect={fit.rect}
                fitMax={fit.max}
                revealId={cardId ?? facilityId}
                revealInset={card ? MAP_CARD_SPACE : 0}
                onPinPress={pressPin}>
                {card ? <PinCard facility={card} walk={walkTo(card)} onOpen={() => openFacility(card)} onClose={() => setCardId(null)} /> : null}
              </VenueMapView>

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
  areaImage: { backgroundColor: Colors.surfaceAlt },
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
