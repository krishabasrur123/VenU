/**
 * Stylized top-down venue map (the Figma map is a placeholder image): an open bowl or an indoor
 * arena drawn in a 400×400 space, with a tappable pin per facility laid over it.
 * Picking a category fills its pins blue and fades the rest; the open facility's pin turns dark.
 */
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { Colors, Fonts, Shadow } from '@/constants/theme';
import { useT } from '@/i18n';

import { FacilityIcon } from './categories';
import { matchesCategory } from './mock';
import type { Facility, FacilityCategory, VenueShape } from './types';

export const MAP_SIZE = 400;

/** Map-only colours (ground, turf, court); everything else comes from the theme. */
const MAP = {
  ground: '#F2F4F1',
  path: '#E4E7E2',
  lot: '#E6E8EB',
  lotLine: '#FFFFFF',
  wall: '#D3D8DF',
  seats: Colors.primarySoft,
  seatLines: '#C3D5F1',
  turf: '#CBE5D0',
  court: '#EAD9BE',
  line: '#FFFFFF',
  courtLine: '#C9A97A',
} as const;

export const MAP_BACKGROUND = MAP.ground;
/** Figma's grey bottom-sheet grabber (#B9B9B9). */
export const SHEET_HANDLE = '#B9B9B9';

function ParkingLot({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <Rect x={x} y={y} width={76} height={60} rx={8} fill={MAP.lot} />
      {[1, 2, 3, 4, 5].map(i => (
        <Line key={i} x1={x + i * 12.6} y1={y + 6} x2={x + i * 12.6} y2={y + 24} stroke={MAP.lotLine} strokeWidth={1.5} />
      ))}
      {[1, 2, 3, 4, 5].map(i => (
        <Line key={`b${i}`} x1={x + i * 12.6} y1={y + 36} x2={x + i * 12.6} y2={y + 54} stroke={MAP.lotLine} strokeWidth={1.5} />
      ))}
    </G>
  );
}

function Bowl() {
  return (
    <G>
      <Ellipse cx={200} cy={200} rx={165} ry={145} fill={Colors.surface} stroke={MAP.wall} strokeWidth={2} />
      <Ellipse cx={200} cy={200} rx={136} ry={116} fill={MAP.seats} stroke={MAP.seatLines} strokeWidth={1.5} />
      <Ellipse cx={200} cy={200} rx={112} ry={93} fill="none" stroke={MAP.seatLines} strokeWidth={1.5} />
      <Rect x={122} y={152} width={156} height={96} rx={10} fill={MAP.turf} />
      <Rect x={130} y={160} width={140} height={80} fill="none" stroke={MAP.line} strokeWidth={1.5} />
      <Line x1={200} y1={160} x2={200} y2={240} stroke={MAP.line} strokeWidth={1.5} />
      <Circle cx={200} cy={200} r={13} fill="none" stroke={MAP.line} strokeWidth={1.5} />
      <Rect x={130} y={183} width={16} height={34} fill="none" stroke={MAP.line} strokeWidth={1.5} />
      <Rect x={254} y={183} width={16} height={34} fill="none" stroke={MAP.line} strokeWidth={1.5} />
    </G>
  );
}

function Arena() {
  return (
    <G>
      <Rect x={35} y={55} width={330} height={290} rx={72} fill={Colors.surface} stroke={MAP.wall} strokeWidth={2} />
      <Rect x={64} y={84} width={272} height={232} rx={56} fill={MAP.seats} stroke={MAP.seatLines} strokeWidth={1.5} />
      <Rect x={88} y={108} width={224} height={184} rx={42} fill="none" stroke={MAP.seatLines} strokeWidth={1.5} />
      <Rect x={136} y={162} width={128} height={76} rx={4} fill={MAP.court} />
      <Line x1={200} y1={162} x2={200} y2={238} stroke={MAP.courtLine} strokeWidth={1.5} />
      <Circle cx={200} cy={200} r={11} fill="none" stroke={MAP.courtLine} strokeWidth={1.5} />
      <Path d="M136 186 h18 v28 h-18" fill="none" stroke={MAP.courtLine} strokeWidth={1.5} />
      <Path d="M264 186 h-18 v28 h18" fill="none" stroke={MAP.courtLine} strokeWidth={1.5} />
    </G>
  );
}

/** The drawing alone, no pins (always north-up, never mirrored for RTL): also the tile on the "Choose Your Venue" cards. */
export function VenueDrawing({ shape, width, height }: { shape: VenueShape; width: number; height: number }) {
  const t = useT('venue');
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`} preserveAspectRatio="xMidYMid meet" aria-hidden>
      {/* Plazas and walkways out from the four gates */}
      <Path d="M200 0 V60 M200 340 V400 M0 200 H40 M360 200 H400" stroke={MAP.path} strokeWidth={14} />
      <ParkingLot x={12} y={328} />
      <ParkingLot x={312} y={328} />
      {shape === 'bowl' ? <Bowl /> : <Arena />}
      <G>
        <Path d="M26 16 L32 30 L26 26 L20 30 Z" fill={Colors.textMuted} />
        <SvgText x={26} y={44} fontSize={11} fontFamily={Fonts.textBold} fill={Colors.textMuted} textAnchor="middle">{t('map.north')}</SvgText>
      </G>
    </Svg>
  );
}

interface StadiumMapProps {
  shape: VenueShape;
  facilities: Facility[];
  width: number;
  height: number;
  category: FacilityCategory | null;
  selectedId?: string;
  onPinPress: (facility: Facility) => void;
}

// Not in a StyleSheet: react-native-web rejects the `direction` style.
const NATIVE_LTR = Platform.OS === 'web' ? null : ({ direction: 'ltr' } as const);

const PIN = 34;
const PIN_SELECTED = 42;

export function StadiumMap({ shape, facilities, width, height, category, selectedId, onPinPress }: StadiumMapProps) {
  const t = useT('venue');
  const scale = Math.min(width / MAP_SIZE, height / MAP_SIZE);
  const ox = (width - MAP_SIZE * scale) / 2;
  const oy = (height - MAP_SIZE * scale) / 2;
  const selected = facilities.find(f => f.id === selectedId);

  return (
    // The map is geographic: east stays on the right in right-to-left languages. Web keeps `left`
    // physical already; native swaps left/right in RTL unless this subtree is laid out LTR.
    <View style={[NATIVE_LTR, { width, height }]}>
      <VenueDrawing shape={shape} width={width} height={height} />
      {facilities.map(f => {
        const isSelected = f.id === selectedId;
        const match = category ? matchesCategory(f, category) : false;
        const dim = !!category && !match && !isSelected;
        const size = isSelected ? PIN_SELECTED : PIN;
        return (
          <Pressable
            key={f.id}
            onPress={() => onPinPress(f)}
            accessibilityRole="button"
            accessibilityLabel={t('map.pin', { name: f.name })}
            accessibilityState={{ selected: isSelected }}
            style={[styles.target, { left: ox + f.x * scale - 22, top: oy + f.y * scale - 22 }, isSelected && styles.onTop]}>
            <View
              style={[
                styles.pin,
                { width: size, height: size, borderRadius: size / 2 },
                match && styles.pinMatch,
                isSelected && styles.pinSelected,
                dim && styles.pinDim,
              ]}>
              <FacilityIcon category={f.category} size={isSelected ? 22 : 18} color={match || isSelected ? Colors.onPrimary : Colors.ink}
                background={isSelected ? Colors.inkDeep : match ? Colors.primary : Colors.surface}
              />
            </View>
          </Pressable>
        );
      })}
      {selected ? (
        <View
          pointerEvents="none"
          style={[styles.label, { left: ox + selected.x * scale - 70, top: oy + selected.y * scale + PIN_SELECTED / 2 + 2 }]}>
          <Text style={styles.labelText} numberOfLines={1}>{selected.name}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  target: { position: 'absolute', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  onTop: { zIndex: 2 },
  pin: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    ...Shadow.card,
  },
  pinMatch: { backgroundColor: Colors.primary, borderColor: Colors.surface, borderWidth: 2, transform: [{ scale: 1.08 }] },
  pinSelected: { backgroundColor: Colors.inkDeep, borderColor: Colors.surface, borderWidth: 2.5 },
  pinDim: { opacity: 0.3 },
  label: { position: 'absolute', width: 140, alignItems: 'center', zIndex: 3 },
  labelText: {
    fontFamily: Fonts.textBold,
    fontSize: 13,
    lineHeight: 17,
    color: Colors.ink,
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
});
