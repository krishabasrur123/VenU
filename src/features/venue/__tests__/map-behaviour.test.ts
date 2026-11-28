import { describe, expect, it, jest } from '@jest/globals';

import {
  centreOn,
  clampView,
  contentSize,
  fitRect,
  IMAGE_ZOOM_OUT_SLACK,
  isStrayPress,
  isVisible,
  mapUpdate,
  minScale,
  PAN_PRESS_GRACE_MS,
  zoomAt,
  zoomStep,
  ZOOM_STEP,
} from '../map-geometry';
import { getFacility, getVenue } from '../mock';
import { mapAspect, venueMapFor } from '../venue-maps';

// mock.ts reaches reports.ts through labels, and reports.ts builds its store on AsyncStorage.
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: async () => null, setItem: async () => {} } }));

const intuitMap = venueMapFor(getVenue('intuit-dome')!);
const f = (id: string) => getFacility('intuit-dome', id)!;

describe('map behaviour', () => {
  it('ignores a pin press that ends a pan', () => {
    expect(isStrayPress(1000, 0, true)).toBe(true); // still panning
    expect(isStrayPress(1000, 1000 - PAN_PRESS_GRACE_MS + 1, false)).toBe(true); // just stopped
    expect(isStrayPress(1000, 1000 - PAN_PRESS_GRACE_MS - 1, false)).toBe(false); // a fresh tap
  });

  it('stops zooming a published map out once it fits, so pins don\'t pile up in a grey field', () => {
    const content = contentSize(mapAspect(intuitMap), 390, IMAGE_ZOOM_OUT_SLACK);
    const viewport = { w: 390, h: 510 };
    expect(minScale(content, viewport)).toBe(1); // the full width, as wide as the screen
    expect(zoomAt({ s: 2, x: 0, y: 0 }, 0.01, { x: 0, y: 0 }, content, viewport).s).toBe(1);
    // The schematic drawing keeps its room around the edges.
    expect(minScale(contentSize(1, 390), viewport)).toBeCloseTo(0.75, 6);
  });

  it('lifts a tapped pin at the bottom of the map clear of the pin card', () => {
    const content = contentSize(mapAspect(intuitMap), 390, IMAGE_ZOOM_OUT_SLACK);
    const viewport = { w: 390, h: 510 };
    const fit = { rect: intuitMap.focus, max: 6, pad: 24, insets: { top: 48, right: 52 } };
    const view = fitRect(fit.rect, content, viewport, fit.pad, fit.max, fit.insets);
    const pin = f('first-aid-terrace');
    const card = 104;
    const room = { w: 390, h: viewport.h - card };
    expect(isVisible(pin, content, view, room, 32)).toBe(false); // under the card before
    const layout = { key: 'focus', vh: 510, w: 390, reveal: null };
    const update = mapUpdate({ prev: layout, next: { ...layout, reveal: pin.id }, moved: false, view, content, viewport, fit, revealPin: pin, revealInset: card });
    expect(isVisible(pin, content, update!.view, room, 32)).toBe(true);
    // It only went as far as the card's top edge allows.
    expect(update!.view).toEqual(clampView(update!.view, content, { ...viewport, inset: card }));
    expect(centreOn(pin, { x: 195, y: room.h / 2 }, view, content, viewport).y).toBeGreaterThan(update!.view.y);
  });

  it('keeps a lifted pin clear of the card after a +/− button zoom, as pan and pinch do', () => {
    const content = contentSize(mapAspect(intuitMap), 390, IMAGE_ZOOM_OUT_SLACK);
    const viewport = { w: 390, h: 510 };
    const fit = { rect: intuitMap.focus, max: 6, pad: 24, insets: { top: 48, right: 52 } };
    const view = fitRect(fit.rect, content, viewport, fit.pad, fit.max, fit.insets);
    const pin = f('first-aid-terrace');
    const card = 104;
    const room = { w: 390, h: viewport.h - card };
    const layout = { key: 'focus', vh: 510, w: 390, reveal: null };
    const lifted = mapUpdate({ prev: layout, next: { ...layout, reveal: pin.id }, moved: false, view, content, viewport, fit, revealPin: pin, revealInset: card })!.view;
    const reach = { ...viewport, inset: card }; // what the gestures clamp to while the card shows
    const out = zoomStep(lifted, 1 / ZOOM_STEP, content, reach);
    expect(isVisible(pin, content, out, room, 32)).toBe(true);
    expect(out).toEqual(clampView(out, content, reach));
    // Clamped to the viewport without the card's inset (the old − button), it sank back under the card.
    expect(isVisible(pin, content, zoomAt(lifted, 1 / ZOOM_STEP, { x: 195, y: 255 }, content, viewport), room, 32)).toBe(false);
  });
});
