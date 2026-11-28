import { describe, expect, it, jest } from '@jest/globals';

function loadTheme(os: 'ios' | 'android' | 'web'): typeof import('../theme') {
  let theme: typeof import('../theme') | undefined;
  jest.isolateModules(() => {
    jest.doMock('react-native', () => ({ Platform: { OS: os } }));
    theme = jest.requireActual('../theme') as typeof import('../theme');
  });
  return theme!;
}

// outlineStyle: 'none' is a web-only value; React Native accepts only solid | dotted | dashed.
describe('webNoOutline', () => {
  const load = (os: 'ios' | 'android' | 'web'): object => loadTheme(os).webNoOutline;

  it('hides the focus ring on web only', () => {
    expect(load('web')).toEqual({ outlineStyle: 'none' });
    expect(load('ios')).toEqual({});
    expect(load('android')).toEqual({});
  });
});

// Alexandria and Albert Sans have no Cyrillic, Armenian or CJK glyphs: on web those fall back to
// system-ui at the element's weight, so a semibold heading needs fontWeight beside its family.
describe('Face', () => {
  it('gives web the weight of each face, so fallback scripts stay bold', () => {
    const { Face } = loadTheme('web');
    expect(Face.displaySemiBold).toEqual({ fontFamily: 'Alexandria_600SemiBold, system-ui, sans-serif', fontWeight: '600' });
    expect(Face.textBold).toEqual({ fontFamily: 'AlbertSans_700Bold, system-ui, sans-serif', fontWeight: '700' });
    expect(Face.display.fontWeight).toBe('400');
  });

  it('keeps native to the family alone', () => {
    for (const os of ['ios', 'android'] as const) {
      const { Face } = loadTheme(os);
      expect(Face.displaySemiBold).toEqual({ fontFamily: 'Alexandria_600SemiBold' });
      expect(Face.textMedium).toEqual({ fontFamily: 'AlbertSans_500Medium' });
    }
  });

  it('puts the weight in the shared text styles', () => {
    const { Type } = loadTheme('web');
    expect(Type.heading.fontWeight).toBe('500');
    expect(Type.label.fontWeight).toBe('700');
  });
});
