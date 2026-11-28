/**
 * How sponsored stands look (./sponsors.ts): the brand's logo on a white tile (SponsorMark), VenU's
 * own Sponsored glyph where a logo is too small to read (a price tag with a star, drawn in the style
 * of the Figma icon sheet: a solid glyph with cut-out details), the "Sponsored" pill, the offer box
 * on the stand, and the promoted card in the facility list (Figma 565:3871).
 * The sponsor accent is the theme's accent (the orange "U" in VenU); the promoted card follows
 * Figma's blue. Logos are demo placements: no brand has a partnership with VenU.
 */
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { FigmaIcon } from '@/components/icons/figma-icon';
import { Colors, Face, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { useLayoutRtl, useT } from '@/i18n';

import { FacilityIcon } from './categories';
import { facilityMeta, facilityName, facilityOffer, type FacilityWalk } from './labels';
import { sponsorLogoOf, type SponsoredStand, type SponsorLogoId } from './sponsors';
import type { Facility } from './types';
import { venueText } from './ui';

/** Sponsored pins, pills and cards are drawn in this colour, on SPONSOR_SOFT. */
export const SPONSOR_ACCENT = Colors.accent;
export const SPONSOR_SOFT = Colors.accentSoft;

/** The logo files (require() ids) and their width / height, so a wide logo (Ben & Jerry's) fits its tile. */
const SPONSOR_LOGOS: Record<SponsorLogoId, { source: number; aspect: number }> = {
  'coca-cola': { source: require('../../../assets/sponsors/coca-cola.png'), aspect: 1 },
  'panda-express': { source: require('../../../assets/sponsors/panda-express.png'), aspect: 1 },
  'ben-jerrys': { source: require('../../../assets/sponsors/ben-jerrys.png'), aspect: 500 / 147 },
};

/**
 * The Sponsored glyph, 24x24: a tag (rounded, its point to the bottom right) with a punched hole and
 * a star cut out of it. `currentColor` is the tag; the hole and star take `background`.
 */
export function sponsoredIconXml(background: string): string {
  let xml = iconCache.get(background);
  if (!xml) {
    xml = iconXml(background);
    iconCache.set(background, xml);
  }
  return xml;
}

// One copy per background colour, built on first use (the map draws a pin per stand).
const iconCache = new Map<string, string>();

const iconXml = (background: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
<path fill="currentColor" d="M3 4.6C3 3.7 3.7 3 4.6 3H11.3C11.75 3 12.15 3.17 12.45 3.47L20.6 11.6C21.2 12.2 21.2 13.2 20.6 13.8L13.8 20.6C13.2 21.2 12.2 21.2 11.6 20.6L3.47 12.45C3.17 12.15 3 11.75 3 11.3Z"/>
<circle fill="${background}" cx="7.3" cy="7.3" r="1.6"/>
<path fill="${background}" d="M13 9.4L14 11.92L16.71 12.09L14.62 13.83L15.29 16.46L13 15L10.71 16.46L11.38 13.83L9.29 12.09L12 11.92Z"/>
</svg>`;

export function SponsoredIcon({ size = 24, color = SPONSOR_ACCENT, background = Colors.surface }: { size?: number; color?: string; background?: string }) {
  return (
    <View style={{ width: size, height: size }} aria-hidden>
      <SvgXml xml={sponsoredIconXml(background)} width={size} height={size} color={color} />
    </View>
  );
}

/** The Sponsored glyph for a sponsored stand, else the facility's category icon. */
export function StandIcon({ facility, size = 24, color, background = Colors.surface }: { facility: Facility; size?: number; color?: string; background?: string }) {
  return facility.sponsor
    ? <SponsoredIcon size={size} color={color ?? SPONSOR_ACCENT} background={background} />
    : <FacilityIcon category={facility.category} size={size} color={color ?? Colors.ink} background={background} />;
}

/**
 * The stand's brand logo on a white rounded tile, `size` square; a stand without a logo gets the
 * Sponsored glyph on the soft accent instead. Decorative: the stand's name says the brand.
 * e.g. <SponsorMark facility={stand} size={52} /> on the promoted card.
 */
export function SponsorMark({ facility, size }: { facility: Facility; size: number }) {
  const logo = sponsorLogoOf(facility);
  if (!logo) {
    return (
      <View style={[styles.mark, styles.markGlyph, { width: size, height: size }]} aria-hidden>
        <SponsoredIcon size={Math.round(size * 0.6)} background={SPONSOR_SOFT} />
      </View>
    );
  }
  const { source, aspect } = SPONSOR_LOGOS[logo];
  // A round or square logo nearly fills the tile; a wide one spans it, letterboxed.
  const inner = size - Math.round(size * (aspect > 1.5 ? 0.1 : 0.14));
  return (
    <View style={[styles.mark, styles.markLogo, { width: size, height: size }]} aria-hidden testID={`sponsor-logo-${logo}`}>
      <Image source={source} style={{ width: inner, height: inner / aspect }} contentFit="contain" accessible={false} />
    </View>
  );
}

/**
 * The "Sponsored" pill. Screen readers get "Sponsored" from the card's own label, so it's hidden from
 * them here. `look="promoted"`: Figma's grey "SPONSORED" pill on the blue promoted card.
 */
export function SponsoredTag({ look }: { look?: 'promoted' }) {
  const t = useT('venue');
  const promoted = look === 'promoted';
  return (
    <View style={[styles.tag, promoted && styles.tagPromoted]} aria-hidden>
      <Text style={[styles.tagText, promoted && styles.tagTextPromoted]} numberOfLines={1}>{t('sponsor.label')}</Text>
    </View>
  );
}

/** On the stand's card: the logo and "Sponsored", the offer, "Show this screen at the stand", and that it's a demo placement. */
export function SponsorOffer({ stand }: { stand: SponsoredStand }) {
  const t = useT('venue');
  return (
    <View style={styles.offer} accessible accessibilityLabel={`${t('sponsor.label')}. ${facilityOffer(stand, t)}. ${t('sponsor.showScreen')}. ${t('sponsor.disclosure')}`}>
      <View style={styles.offerHead}>
        <SponsorMark facility={stand} size={40} />
        <Text style={styles.offerLabel}>{t('sponsor.label')}</Text>
      </View>
      <Text style={styles.offerText}>{facilityOffer(stand, t)}</Text>
      <Text style={venueText.caption}>{t('sponsor.showScreen')}</Text>
      <Text style={styles.disclosure}>{t('sponsor.disclosure')}</Text>
    </View>
  );
}

/**
 * The facility list's promoted card (Figma 565:3871): one per venue (see facilityListLayout), blue,
 * with the brand's logo, "SPONSORED", the stand, its offer and walk. `walk` is the same walk the
 * list's rows show (walkTo: from the visitor's spot, else the way in).
 */
export function PromotedCard({ stand, walk, onPress }: { stand: SponsoredStand; walk: FacilityWalk | null | undefined; onPress: () => void }) {
  const t = useT('venue');
  const rtl = useLayoutRtl();
  const name = facilityName(stand, t);
  const offer = facilityOffer(stand, t);
  const meta = facilityMeta(stand, t, walk);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('sponsor.card', { name, offer, meta })}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <SponsorMark facility={stand} size={52} />
      <View style={styles.cardText}>
        <SponsoredTag look="promoted" />
        <Text style={styles.cardTitle} numberOfLines={2}>{name}</Text>
        <Text style={styles.cardOffer} numberOfLines={2}>{offer}</Text>
        <Text style={venueText.caption} numberOfLines={1}>{meta}</Text>
      </View>
      <View style={rtl && styles.flip}>
        <FigmaIcon name="group-2-af556f" size={32} color={Colors.ink} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tag: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 1, borderRadius: 6, backgroundColor: SPONSOR_SOFT },
  tagText: { ...Face.textBold, fontSize: 12, lineHeight: 16, color: SPONSOR_ACCENT },
  // Figma: a light grey pill with blue capitals.
  tagPromoted: { paddingHorizontal: Spacing.sm, paddingVertical: 2, backgroundColor: Colors.surfaceAlt },
  tagTextPromoted: { ...Face.textMedium, letterSpacing: 0.6, textTransform: 'uppercase', color: Colors.primary },

  mark: { alignItems: 'center', justifyContent: 'center', borderRadius: Radius.sm, overflow: 'hidden' },
  markGlyph: { backgroundColor: SPONSOR_SOFT },
  markLogo: { backgroundColor: Colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },

  offer: { gap: 4, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: SPONSOR_SOFT },
  offerHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  offerLabel: { ...Face.textBold, fontSize: 13, lineHeight: 17, color: SPONSOR_ACCENT },
  offerText: { ...Face.displayMedium, fontSize: 16, lineHeight: 21, color: Colors.text },
  disclosure: { fontFamily: Fonts.text, fontSize: 12, lineHeight: 16, color: Colors.textMuted },

  // Figma: pale blue card, blue outline, radius 10.
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingStart: Spacing.md,
    paddingEnd: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
    ...Shadow.card,
  },
  cardPressed: { opacity: 0.85 },
  cardText: { flex: 1, gap: 4 },
  cardTitle: { ...Face.displayMedium, fontSize: 20, lineHeight: 25, color: Colors.text },
  cardOffer: { ...Face.textSemiBold, fontSize: 13, lineHeight: 17, color: Colors.primary },
  flip: { transform: [{ scaleX: -1 }] },
});
