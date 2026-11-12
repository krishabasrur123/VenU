// Design tokens from the hi-fi Figma (file WsE4dtVcbpIWfDokV0sYhc, snapshot in .kiro/figma/venu).
// Screens use these names only, never raw hex, so a design change here restyles the whole app.
//
// Deliberate departures from the Figma file, for readability on a 390pt phone (Figma frames are 440):
// - text Figma sets at 11px is 13px here, and 13px body text is 15px;
// - control borders are #8C8C8C, not #A6A6A6, so inputs and chips keep a 3:1 edge on white (WCAG 1.4.11);
// - placeholders are #767676 (4.5:1), not #A6A6A6.

import { Platform } from 'react-native';

export const Colors = {
  primary: '#1D5DBC',     // links, selected chips, primary actions ("Send Request", "Save and continue")
  primarySoft: '#DFEBFD', // selected chip fill, info cards, active nav pill
  ink: '#242222',         // dark buttons ("Sign In"), headings
  inkDeep: '#25282C',     // active tab circle
  accent: '#C2410C',      // the "U" in VenU, Get help
  accentSoft: '#FDEDE6',
  warning: '#FF9F4B',     // stars, "busy" badges (never for text on white: 2:1)
  success: '#368847',
  successStrong: '#2F7D40', // behind white text ("Accessible" tag): 5.1:1, where success is 4.4:1
  successSoft: '#E7F5EC',
  danger: '#A81C1C',
  dangerSoft: '#FDECEC',  // error banners
  emergencySoft: '#F7B9B9', // "Emergency? Call 911" card
  bg: '#FFFFFF',          // page background
  surface: '#FFFFFF',     // inputs, raised cards
  surfaceAlt: '#F5F5F5',  // tiles and info cards on a white page
  controlBorder: '#8C8C8C', // input and chip outlines (>= 3:1 on white)
  border: '#E3E3E3',      // decorative card outlines
  divider: '#EEEEEE',
  text: '#242222',
  textMuted: '#49454F',
  textFaint: '#767676',   // placeholders, chevrons: 4.5:1 on white
  onPrimary: '#FFFFFF',
} as const;

/** Font family names, as loaded in src/app/_layout.tsx. Set `fontFamily`, not `fontWeight`: each name is one weight. */
export const Fonts = {
  display: withFallback('Alexandria_400Regular'),      // titles, body copy, buttons
  displayMedium: withFallback('Alexandria_500Medium'),
  displaySemiBold: withFallback('Alexandria_600SemiBold'),
  text: withFallback('AlbertSans_400Regular'),         // captions, inputs, small print
  textMedium: withFallback('AlbertSans_500Medium'),
  textSemiBold: withFallback('AlbertSans_600SemiBold'),
  textBold: withFallback('AlbertSans_700Bold'),        // field labels, tab labels
} as const;

/**
 * Alexandria covers Latin, Vietnamese and Arabic; Albert Sans only Latin. Phones fall back to the
 * system sans for other scripts (Cyrillic, Armenian, CJK…), but a browser falls back to its default
 * serif, so on web the name gets a sans-serif stack: "Alexandria_400Regular, system-ui, sans-serif".
 */
function withFallback<F extends string>(family: F): F {
  return (Platform.OS === 'web' ? `${family}, system-ui, sans-serif` : family) as F;
}

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, gutter: 20, xl: 24, xxl: 32 } as const;

/** Figma uses 10 for buttons, inputs and cards, 8 for chips. */
export const Radius = { sm: 8, md: 10, lg: 16, pill: 999 } as const;

export const Type = {
  title: { fontFamily: Fonts.display, fontSize: 24, lineHeight: 30, color: Colors.text },
  heading: { fontFamily: Fonts.displayMedium, fontSize: 18, lineHeight: 24, color: Colors.text },
  body: { fontFamily: Fonts.display, fontSize: 15, lineHeight: 20, color: Colors.text },
  bodyStrong: { fontFamily: Fonts.displayMedium, fontSize: 15, lineHeight: 20, color: Colors.text },
  label: { fontFamily: Fonts.textBold, fontSize: 13, lineHeight: 16, color: Colors.text },
  caption: { fontFamily: Fonts.text, fontSize: 13, lineHeight: 17, color: Colors.textMuted },
  input: { fontFamily: Fonts.text, fontSize: 15, lineHeight: 20, color: Colors.text },
  button: { fontFamily: Fonts.display, fontSize: 15, lineHeight: 20 },
  buttonLarge: { fontFamily: Fonts.display, fontSize: 20, lineHeight: 26 },
  overline: { fontFamily: Fonts.textBold, fontSize: 11, color: Colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
} as const;

/** Figma drop shadows. Spread into a style: `{ ...Shadow.card }`. */
export const Shadow = {
  /** Tiles and cards: 0 4 4 rgba(0,0,0,.25) in Figma, softened a little for a white page. */
  card: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.16, shadowRadius: 6, elevation: 3 },
  /** Floating tab bar and bottom sheets. */
  float: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 8 },
  /** Pressed / "Variant2" state of the Figma buttons. */
  pressed: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 4 },
} as const;

/** Web only: the app renders in a centred column this wide instead of stretching across a desktop. */
export const WEB_COLUMN_MAX = 520;
