import { describe, expect, it, jest } from '@jest/globals';

import {
  boundsOf,
  centreOn,
  clampView,
  contentSize,
  fitRect,
  isVisible,
  mapUpdate,
  MAX_SCALE,
  minScale,
  pinsFor,
  toMap,
  toScreen,
  walkBetween,
  zoomAt,
  type MapRect,
  type MapView,
} from '../map-geometry';
import { facilitiesFor, getFacility } from '../mock';

// mock.ts reaches reports.ts through labels, and reports.ts builds its store on AsyncStorage.
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: async () => null, setItem: async () => {} } }));

// SoFi's map is 2550×3300: across a 390-wide phone it's 390 × 504.7 content px.
const content = contentSize(2550 / 3300, 390);
const viewport = { w: 390, h: 420 };
const close = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  expect(a.x).toBeCloseTo(b.x, 6);
  expect(a.y).toBeCloseTo(b.y, 6);
};

describe('normalized positions on screen', () => {
  it('lays the image out across the map area at its own aspect ratio', () => {
    expect(content.w).toBe(390);
    expect(content.h).toBeCloseTo(504.7, 1);
  });

  it('places a pin under pan and zoom: offset + scale × content px', () => {
    const view: MapView = { s: 2, x: -100, y: -50 };
    expect(toScreen({ x: 0.5, y: 0.25 }, content, view)).toEqual({ x: -100 + 2 * 195, y: -50 + 2 * 0.25 * content.h });
    expect(toScreen({ x: 0, y: 0 }, content, view)).toEqual({ x: -100, y: -50 });
    close(toMap(toScreen({ x: 0.3, y: 0.7 }, content, view), content, view), { x: 0.3, y: 0.7 });
  });

  it('keeps the spot under the fingers fixed while zooming there', () => {
    const view = fitRect([0.25, 0.2, 0.61, 0.54], content, viewport);
    const at = { x: 120, y: 200 };
    const under = toMap(at, content, view);
    const zoomed = zoomAt(view, 1.5, at, content, viewport);
    expect(zoomed.s).toBeCloseTo(view.s * 1.5, 6);
    close(toScreen(under, content, zoomed), at);
  });

  it('stops zooming out once the whole map fits, and in at MAX_SCALE', () => {
    expect(zoomAt({ s: 1, x: 0, y: 0 }, 0.01, { x: 0, y: 0 }, content, viewport).s).toBeCloseTo(minScale(content, viewport), 6);
    expect(zoomAt({ s: 5, x: 0, y: 0 }, 10, { x: 0, y: 0 }, content, viewport).s).toBe(MAX_SCALE);
  });

  it('never lets the map be dragged off: a larger axis stays over the viewport, a smaller one is centred', () => {
    const big = clampView({ s: 2, x: 500, y: -5000 }, content, viewport);
    expect(big.x).toBe(0);
    expect(big.y).toBeCloseTo(viewport.h - 2 * content.h, 6);
    const small = clampView({ s: 1, x: 80, y: 0 }, contentSize(16 / 9, 390), viewport); // Intuit Dome's landscape map
    expect(small.x).toBe(0);
    expect(small.y).toBeCloseTo((420 - 390 / (16 / 9)) / 2, 6);
  });

  it('fits a region in the part of the map the sheet leaves visible', () => {
    const lowSheet = fitRect([0.25, 0.2, 0.61, 0.54], content, { w: 390, h: 430 }, 28);
    const midSheet = fitRect([0.25, 0.2, 0.61, 0.54], content, { w: 390, h: 300 }, 28);
    for (const [view, h] of [[lowSheet, 430], [midSheet, 300]] as const) {
      const tl = toScreen({ x: 0.25, y: 0.2 }, content, view);
      const br = toScreen({ x: 0.61, y: 0.54 }, content, view);
      expect(tl.x).toBeGreaterThanOrEqual(27.9);
      expect(tl.y).toBeGreaterThanOrEqual(27.9);
      expect(br.x).toBeLessThanOrEqual(390 - 27.9);
      expect(br.y).toBeLessThanOrEqual(h - 27.9);
    }
    expect(midSheet.s).toBeLessThan(lowSheet.s);
  });

  it('keeps a fitted region below the bar over the map\'s top edge', () => {
    const view = fitRect([0.4, 0.4, 0.8, 0.7], content, viewport, 24, 6, { top: 52, right: 52 });
    expect(view.s).toBeGreaterThan(1);
    expect(toScreen({ x: 0.4, y: 0.4 }, content, view).y).toBeGreaterThanOrEqual(52 + 24 - 1e-6);
    expect(toScreen({ x: 0.8, y: 0.7 }, content, view).y).toBeLessThanOrEqual(viewport.h - 24 + 1e-6);
    // …and left of the zoom buttons at the right edge.
    expect(toScreen({ x: 0.8, y: 0.7 }, content, view).x).toBeLessThanOrEqual(viewport.w - 52 - 24 + 1e-6);
  });

  it('zooms a whole square map out a little, so pins on its east edge clear the zoom buttons', () => {
    const square = contentSize(1, 390); // Crypto.com Arena's schematic
    const view = fitRect([0, 0, 1, 1], square, { w: 390, h: 430 }, 24, 6, { top: 52, right: 52 });
    expect(view.s).toBeLessThan(1);
    expect(toScreen({ x: 0.95, y: 0.5 }, square, view).x).toBeLessThan(390 - 52);
  });

  it('caps how far a fit zooms in, so one pin still shows its surroundings', () => {
    expect(fitRect([0.4, 0.4, 0.4, 0.4], content, viewport, 28, 3).s).toBe(3);
  });

  it('moves a point to a spot on screen without changing the zoom, and says what is visible', () => {
    const view = fitRect([0.25, 0.2, 0.61, 0.54], content, viewport);
    const moved = centreOn({ x: 0.5, y: 0.5 }, { x: 195, y: 210 }, view, content, viewport);
    expect(moved.s).toBe(view.s);
    close(toScreen({ x: 0.5, y: 0.5 }, content, moved), { x: 195, y: 210 });
    expect(isVisible({ x: 0.5, y: 0.5 }, content, moved, viewport)).toBe(true);
    expect(isVisible({ x: 0.05, y: 0.95 }, content, moved, viewport)).toBe(false);
  });
});

describe('pinsFor', () => {
  const sofi = facilitiesFor('sofi');

  it('shows every pin for "All"', () => {
    expect(pinsFor(sofi, null)).toEqual(sofi);
  });

  it('shows only the chip\'s category, the same facilities the list shows', () => {
    expect(pinsFor(sofi, 'restroom').map(f => f.id)).toEqual(['restrooms-n', 'restrooms-sw', 'adult-changing', 'lactation-suite', 'restrooms-nw', 'restrooms-se']);
    expect(pinsFor(facilitiesFor('crypto-arena'), 'restroom').map(f => f.id)).toEqual(['restroom-m23', 'restroom-u31']);
    expect(pinsFor(sofi, 'first_aid').map(f => f.id)).toEqual(['first-aid-ne', 'first-aid-nw', 'first-aid-se', 'first-aid-se-6', 'first-aid-sw-6']);
  });

  it('counts accessible facilities as Accessibility, like the list', () => {
    const pins = pinsFor(sofi, 'accessible');
    expect(pins.length).toBeGreaterThan(1);
    expect(pins.every(f => f.accessible || f.category === 'accessible')).toBe(true);
  });

  it('keeps the open facility and a route\'s ends whatever the chip', () => {
    expect(pinsFor(facilitiesFor('crypto-arena'), 'restroom', ['figueroa-entrance', null, undefined]).map(f => f.id)).toEqual(['figueroa-entrance', 'restroom-m23', 'restroom-u31']);
  });

  it('has nothing for a chip the venue has no facility for', () => {
    expect(pinsFor(facilitiesFor('crypto-arena'), 'food')).toEqual([]);
  });
});

describe('boundsOf', () => {
  it('spans the pins, or is empty without any', () => {
    expect(boundsOf([{ x: 0.2, y: 0.6 }, { x: 0.5, y: 0.1 }])).toEqual([0.2, 0.1, 0.5, 0.6]);
    expect(boundsOf([])).toBeNull();
  });
});

describe('walkBetween', () => {
  it('draws the line from the visitor\'s spot to the facility\'s pin, in content px', () => {
    const from = getFacility('sofi', 'entry-4')!;
    const to = getFacility('sofi', 'first-aid-se')!;
    const { line } = walkBetween(from, to, content, 2200);
    expect(line).toEqual({ x1: from.x * 390, y1: from.y * content.h, x2: to.x * 390, y2: to.y * content.h });
    // The ends sit on the pins wherever the map is panned and zoomed.
    const view: MapView = { s: 2.4, x: -300, y: -200 };
    close(toScreen(from, content, view), { x: view.x + view.s * line.x1, y: view.y + view.s * line.y1 });
    close(toScreen(to, content, view), { x: view.x + view.s * line.x2, y: view.y + view.s * line.y2 });
  });

  it('estimates the walk from the map\'s real width', () => {
    const square = { w: 390, h: 390 };
    expect(walkBetween({ x: 0.2, y: 0.5 }, { x: 0.4, y: 0.5 }, square, 500)).toMatchObject({ meters: 130, minutes: 2, steps: 170, heading: 'e' });
    // The same walk on a narrower phone: same metres.
    expect(walkBetween({ x: 0.2, y: 0.5 }, { x: 0.4, y: 0.5 }, { w: 300, h: 300 }, 500).meters).toBe(130);
  });

  it('names the heading on a north-up map', () => {
    const square = { w: 100, h: 100 };
    const head = (x: number, y: number) => walkBetween({ x: 0.5, y: 0.5 }, { x, y }, square, 100).heading;
    expect([head(0.5, 0.1), head(0.9, 0.1), head(0.9, 0.5), head(0.9, 0.9), head(0.5, 0.9), head(0.1, 0.9), head(0.1, 0.5), head(0.1, 0.1)])
      .toEqual(['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']);
  });

  it('gives at least a minute and ten steps for the shortest walk', () => {
    expect(walkBetween({ x: 0.5, y: 0.5 }, { x: 0.5001, y: 0.5 }, { w: 100, h: 100 }, 100)).toMatchObject({ minutes: 1, steps: 10 });
  });
});

describe('mapUpdate', () => {
  // Sheet down leaves 600 px of map; mid leaves 420. The fit zooms into the middle of the bowl.
  const down = { w: 390, h: 600 };
  const mid = { w: 390, h: 420 };
  const fit = { rect: [0.35, 0.35, 0.65, 0.6] as MapRect, max: MAX_SCALE, pad: 24, insets: { top: 48, right: 52 } };
  const far = { x: 0.06, y: 0.93 };
  const layout = (vh: number, reveal: string | null = null) => ({ key: 'focus', vh, w: 390, reveal });
  const fitted = (vp: { w: number; h: number }) => fitRect(fit.rect, content, vp, fit.pad, fit.max, fit.insets);
  const base = { content, fit, revealInset: 0, moved: false };

  it('fits on first layout and on a new key', () => {
    expect(mapUpdate({ ...base, prev: null, next: layout(600), view: { s: 1, x: 0, y: 0 }, viewport: down })).toEqual({ view: fitted(down), refit: true });
    expect(mapUpdate({ ...base, prev: layout(600), next: { ...layout(600), key: 'chip:food' }, view: fitted(down), viewport: down })?.refit).toBe(true);
  });

  it('stays put when nothing it watches changed', () => {
    expect(mapUpdate({ ...base, prev: layout(600, 'x'), next: layout(600, 'x'), view: fitted(down), viewport: down, revealPin: far })).toBeNull();
  });

  it('brings a pin revealed in the same render as a sheet move on screen, after the refit', () => {
    // Tapping a far-off facility in the list: the sheet rises down → mid and it opens, at once.
    expect(isVisible(far, content, fitted(mid), mid, 32)).toBe(false);
    const update = mapUpdate({ ...base, prev: layout(600), next: layout(420, 'far'), view: fitted(down), viewport: mid, revealPin: far })!;
    expect(update.refit).toBe(true);
    expect(update.view.s).toBeCloseTo(fitted(mid).s, 6); // the refit's zoom, moved over to the pin
    expect(isVisible(far, content, update.view, mid, 32)).toBe(true);
  });

  it('reveals after keeping the middle when the visitor had moved the map', () => {
    const update = mapUpdate({ ...base, moved: true, prev: layout(600), next: layout(420, 'far'), view: { s: 3, x: -300, y: -300 }, viewport: mid, revealPin: far })!;
    expect(update.refit).toBe(false);
    expect(update.view.s).toBe(3);
    expect(isVisible(far, content, update.view, mid, 32)).toBe(true);
  });

  it('keeps the revealed pin above the card', () => {
    const pin = { x: 0.5, y: 0.6 };
    const room = { w: 390, h: 420 - 104 };
    expect(isVisible(pin, content, fitted(mid), room, 32)).toBe(false);
    const update = mapUpdate({ ...base, revealInset: 104, prev: layout(420), next: layout(420, 'p'), view: fitted(mid), viewport: mid, revealPin: pin })!;
    expect(isVisible(pin, content, update.view, room, 32)).toBe(true);
  });

  it('leaves a revealed pin that is already on screen where it is', () => {
    const update = mapUpdate({ ...base, prev: layout(600), next: layout(420, 'c'), view: fitted(down), viewport: mid, revealPin: { x: 0.5, y: 0.47 } });
    expect(update).toEqual({ view: fitted(mid), refit: true });
  });
});
