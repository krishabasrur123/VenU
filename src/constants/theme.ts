// Design tokens from the VenU Figma file (XR navigation bar and screens).

export const FigmaColors = {
  darkGray: 'rgba(36, 34, 34, 1)',
  lightBlue: 'rgba(223, 235, 253, 1)',
  white: 'rgba(255, 255, 255, 1)',
} as const;

export const FigmaTypography = {
  label: {
    fontFamily: 'Albert Sans',
    fontWeight: '700' as const,
    fontSize: 12,
    lineHeight: 12,
    letterSpacing: 0,
  },
  subtitle: {
    fontFamily: 'Albert Sans',
    fontWeight: '400' as const,
    fontSize: 11,
    lineHeight: 11,
    letterSpacing: 0,
  },
} as const;

export const FigmaShadows = {
  iconContainer: {
    shadowColor: 'rgba(0,0,0,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 2.5,
    elevation: 3,
  },
  navigationBar: {
    shadowColor: 'rgba(0,0,0,1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 4,
  },
} as const;
