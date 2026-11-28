// The logo draws its outline on, then fills; with Reduce Motion on it shows finished at once.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act } from 'react';
import { AccessibilityInfo } from 'react-native';
import { createRoot, type TestInstance } from 'test-renderer';

import { LOGO_DONE, LOGO_DRAW_MS, LOGO_LOOP_MS, LOGO_REVEAL_MS, logoFrame, pathLength } from '../logo-draw';
import { LOGO_HEART_OUTLINES } from '../logo-heart';
import { LogoReveal } from '../logo-reveal';

/** Dash offsets of the drawn outlines, and the fill's opacity. */
function state(c: TestInstance) {
  const paths = c.queryAll(n => n.props.d !== undefined && n.props.strokeDasharray !== undefined);
  const fill = c.queryAll(n => n.props.d !== undefined && n.props.fillOpacity !== undefined)[0];
  return {
    outlines: paths.length,
    drawn: paths.every(p => Number(p.props.strokeDashoffset) === 0),
    hidden: paths.every(p => Number(p.props.strokeDashoffset) > 0),
    fill: Number(fill?.props.fillOpacity),
  };
}

describe('pathLength', () => {
  it('measures lines, closes and curves', () => {
    expect(pathLength('M0 0L3 4')).toBe(5);
    expect(pathLength('M0 0H10V10H0Z')).toBe(40);
    expect(pathLength('m1 1l3 4')).toBe(5);
    // A straight cubic is as long as its chord.
    expect(pathLength('M0 0C1 0 2 0 3 0')).toBeCloseTo(3, 5);
    // A quarter circle of radius 10 as a cubic: about 15.71.
    expect(pathLength('M10 0C10 5.523 5.523 10 0 10')).toBeCloseTo(15.71, 1);
  });

  it('measures every logo outline', () => {
    const lengths = LOGO_HEART_OUTLINES.map(pathLength);
    expect(lengths).toHaveLength(6);
    expect(lengths.every(l => l > 20 && l < 600)).toBe(true);
  });
});

describe('logoFrame', () => {
  it('draws the outline easing out, then fades the fill in, then stops', () => {
    expect(logoFrame(0)).toEqual({ draw: 0, fill: 0, opacity: 1 });
    expect(logoFrame(LOGO_DRAW_MS / 2)).toEqual({ draw: 0.88, fill: 0, opacity: 1 }); // ease-out: most of it by halfway
    expect(logoFrame(LOGO_DRAW_MS)).toEqual({ draw: 1, fill: 0, opacity: 1 });
    expect(logoFrame(LOGO_DRAW_MS + 200)).toEqual({ draw: 1, fill: 0.5, opacity: 1 });
    expect(logoFrame(LOGO_REVEAL_MS)).toEqual(LOGO_DONE);
    expect(logoFrame(60_000)).toEqual(LOGO_DONE);
  });

  it('loops: holds the finished logo, fades out, then starts over', () => {
    expect(logoFrame(LOGO_REVEAL_MS + 500, true)).toEqual(LOGO_DONE);
    const fading = logoFrame(LOGO_LOOP_MS - 400, true);
    expect(fading.opacity).toBeGreaterThan(0);
    expect(fading.opacity).toBeLessThan(1);
    expect(logoFrame(LOGO_LOOP_MS - 50, true).opacity).toBe(0);
    expect(logoFrame(LOGO_LOOP_MS, true)).toEqual(logoFrame(0, true));
    expect(logoFrame(LOGO_LOOP_MS * 3 + 600, true)).toEqual(logoFrame(600, true));
  });
});

describe('LogoReveal', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('with Reduce Motion on, shows the finished logo at once and never animates', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const raf = jest.spyOn(global, 'requestAnimationFrame');
    const root = createRoot();
    await act(async () => { root.render(<LogoReveal />); });
    expect(state(root.container)).toEqual({ outlines: 6, drawn: true, hidden: false, fill: 1 });
    expect(raf).not.toHaveBeenCalled();
  });

  it('otherwise starts empty and is finished after the reveal', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const root = createRoot();
    await act(async () => { root.render(<LogoReveal />); });
    expect(state(root.container)).toMatchObject({ outlines: 6, hidden: true, fill: 0 });

    await act(async () => { jest.advanceTimersByTime(LOGO_DRAW_MS / 2); });
    expect(state(root.container)).toMatchObject({ hidden: true, fill: 0 }); // part drawn

    await act(async () => { jest.advanceTimersByTime(LOGO_REVEAL_MS); });
    expect(state(root.container)).toEqual({ outlines: 6, drawn: true, hidden: false, fill: 1 });
  });
});
