/**
 * The venue map's maths, kept pure so it's tested without a screen.
 *
 * - A point on a map is normalized: x and y from 0 to 1 across the image (0,0 = top left).
 * - The image is laid out as "content" `cw` wide and `ch` tall (the map area's width, at the image's
 *   aspect ratio), then shown under a View: screen = (x + s · cx, y + s · cy) for content px (cx, cy).
 * - The viewport is the part of the map area the sheet doesn't cover: `vw` wide, `vh` tall from the top.
 *
 * e.g. on a 390-wide content box shown at s = 2, x = -100: the point (0.5, …) lands at 290 on screen.
 *
 * minScale, clampView and zoomAt are worklets: the pan and pinch gestures call them on the UI thread.
 */
import { matchesCategory } from './mock';
import type { Facility, FacilityCategory } from './types';

export interface MapPoint {
  x: number;
  y: number;
}

/** How the content is placed on screen: scale, then offset in screen px. */
export interface MapView {
  s: number;
  x: number;
  y: number;
}

export interface Box {
  w: number;
  h: number;
  /** Content only: how far past "the whole map fits" it zooms out (see minScale). */
  slack?: number;
  /** Viewport only: px along its bottom that the pin card covers; the map may pan up to clear them. */
  inset?: number;
}

/** A normalized region: [left, top, right, bottom]. */
export type MapRect = [number, number, number, number];

export const MAX_SCALE = 6;
/** A chip's pins, or a route, never zoom in past this: they should still show some context. */
export const FIT_MAX_SCALE = 3.2;

/**
 * Content size for an image `aspect` (width / height) laid out across a map area `width` wide, and
 * its zoom-out `slack` (see minScale). e.g. contentSize(16 / 9, 390, 1) → { w: 390, h: 219.4, slack: 1 }
 */
export function contentSize(aspect: number, width: number, slack?: number): Box {
  return slack === undefined ? { w: width, h: width / aspect } : { w: width, h: width / aspect, slack };
}

/** Where a normalized point shows on screen. */
export function toScreen(p: MapPoint, content: Box, view: MapView): MapPoint {
  return { x: view.x + view.s * p.x * content.w, y: view.y + view.s * p.y * content.h };
}

/** The normalized point under a screen point (the inverse of toScreen). */
export function toMap(screen: MapPoint, content: Box, view: MapView): MapPoint {
  return { x: (screen.x - view.x) / (view.s * content.w), y: (screen.y - view.y) / (view.s * content.h) };
}

/**
 * How far past "the whole image fits" the map zooms out by default, so pins at its edges clear the
 * buttons. The schematic drawing keeps it; a published map image passes 1 (IMAGE_ZOOM_OUT_SLACK).
 */
export const ZOOM_OUT_SLACK = 0.75;
/** A published map stops zooming out once it fits: past that it only shrinks into a blank field with its pins piled up. */
export const IMAGE_ZOOM_OUT_SLACK = 1;

/** Smallest scale: the whole image fits in the viewport, with `content.slack` room around it. */
export function minScale(content: Box, viewport: Box): number {
  'worklet';
  return Math.min(viewport.w / content.w, viewport.h / content.h, 1) * (content.slack ?? ZOOM_OUT_SLACK);
}

/**
 * Keeps the image in reach: an axis that's smaller than the viewport is centred on it, a larger one
 * can't be dragged past its edges (its bottom edge may rise to `viewport.inset` above the bottom,
 * so a pin there can clear the pin card). Scale is held between minScale and MAX_SCALE.
 */
export function clampView(view: MapView, content: Box, viewport: Box): MapView {
  'worklet';
  const s = Math.min(Math.max(view.s, minScale(content, viewport)), MAX_SCALE);
  const axis = (offset: number, size: number, room: number, inset: number) => {
    const shown = size * s;
    const centred = (room - shown) / 2;
    // Smaller: centred, or raised as far as the inset asks. Larger: edges stay outside the viewport.
    if (shown <= room) return Math.min(Math.max(offset, Math.min(room - inset - shown, centred)), centred);
    return Math.min(Math.max(offset, room - inset - shown), 0);
  };
  return { s, x: axis(view.x, content.w, viewport.w, 0), y: axis(view.y, content.h, viewport.h, viewport.inset ?? 0) };
}

/** Zooms by `factor` around a screen point, which stays over the same spot on the map. */
export function zoomAt(view: MapView, factor: number, at: MapPoint, content: Box, viewport: Box): MapView {
  'worklet';
  const s = Math.min(Math.max(view.s * factor, minScale(content, viewport)), MAX_SCALE);
  const k = s / view.s;
  return clampView({ s, x: at.x - (at.x - view.x) * k, y: at.y - (at.y - view.y) * k }, content, viewport);
}

/** How much one press of the map's + button zooms in (− zooms out by 1 / ZOOM_STEP). */
export const ZOOM_STEP = 1.6;

/**
 * A +/− button press: zooms about the middle of the viewport, clamped to the same box as pan, pinch
 * and the wheel (`reach`, with the pin card's inset), so a pin lifted clear of the card stays clear.
 */
export function zoomStep(view: MapView, factor: number, content: Box, reach: Box): MapView {
  return zoomAt(view, factor, { x: reach.w / 2, y: reach.h / 2 }, content, reach);
}

/** How long after a pan ends a press still counts as part of it (web fires the click on release). */
export const PAN_PRESS_GRACE_MS = 250;

/**
 * Whether a press on a pin is really the end of a drag that started on it: the map is panning, or
 * stopped panning within PAN_PRESS_GRACE_MS. Such a press shouldn't open the pin's card.
 * e.g. isStrayPress(1000, 900, false) → true; isStrayPress(1000, 500, false) → false
 */
export function isStrayPress(now: number, lastPanEnd: number, panning: boolean): boolean {
  return panning || now - lastPanEnd < PAN_PRESS_GRACE_MS;
}

/** Screen px a fit keeps clear along the viewport's top and right edges (the bar and buttons over the map). */
export interface FitInsets {
  top: number;
  right: number;
}

/**
 * The view that shows a normalized region as large as fits in the viewport, centred, with `pad`
 * screen px around it and `insets` kept clear beyond that, zoomed in no further than `maxScale`.
 * e.g. fitRect([0, 0, 1, 1], …) shows the whole image.
 */
export function fitRect(rect: MapRect, content: Box, viewport: Box, pad = 24, maxScale = MAX_SCALE, insets: FitInsets = { top: 0, right: 0 }): MapView {
  const [l, t, r, b] = rect;
  const rw = Math.max((r - l) * content.w, 1);
  const rh = Math.max((b - t) * content.h, 1);
  const roomW = Math.max(viewport.w - insets.right, 1);
  const roomH = Math.max(viewport.h - insets.top, 1);
  const s = Math.min((roomW - 2 * pad) / rw, (roomH - 2 * pad) / rh, maxScale);
  const cx = ((l + r) / 2) * content.w;
  const cy = ((t + b) / 2) * content.h;
  return clampView({ s, x: roomW / 2 - cx * s, y: insets.top + roomH / 2 - cy * s }, content, viewport);
}

/** The smallest region holding every point (a single point gives a zero-size region). */
export function boundsOf(points: MapPoint[]): MapRect | null {
  if (!points.length) return null;
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/** Moves the view, keeping its scale, so that a normalized point sits at a screen point. */
export function centreOn(p: MapPoint, at: MapPoint, view: MapView, content: Box, viewport: Box): MapView {
  return clampView({ s: view.s, x: at.x - p.x * content.w * view.s, y: at.y - p.y * content.h * view.s }, content, viewport);
}

/** Whether a normalized point is on screen, at least `margin` px inside the viewport's edges. */
export function isVisible(p: MapPoint, content: Box, view: MapView, viewport: Box, margin = 24): boolean {
  const q = toScreen(p, content, view);
  return q.x >= margin && q.x <= viewport.w - margin && q.y >= margin && q.y <= viewport.h - margin;
}

/** What the map view last laid out for: its fit key, viewport height, width and revealed pin. */
export interface MapLayout {
  key: string;
  vh: number;
  w: number;
  reveal: string | null | undefined;
}

export interface MapUpdate {
  prev: MapLayout | null;
  next: MapLayout;
  /** The visitor moved the map since the last fit. */
  moved: boolean;
  view: MapView;
  content: Box;
  viewport: Box;
  fit: { rect: MapRect; max: number; pad: number; insets: FitInsets };
  /** The pin `next.reveal` names, if it's drawn. */
  revealPin?: MapPoint;
  /** Viewport px at the bottom a revealed pin must stay above (the pin card). */
  revealInset: number;
}

/**
 * Where the map goes when its inputs change, or null to stay put. In order:
 * 1. A new fit key or width, or a sheet move the visitor hasn't panned since: fit `fit.rect` again
 *    (`refit`, so the caller clears `moved`). A sheet move after panning instead keeps what was in
 *    the middle of the visible part in the middle.
 * 2. Then, a newly revealed pin that the view from step 1 leaves hidden (or behind the card) is
 *    centred in the room above the card. Both can happen in one render: tapping a facility in the
 *    list raises the sheet and opens it at once.
 */
export function mapUpdate(u: MapUpdate): { view: MapView; refit: boolean } | null {
  const { prev, next, content, viewport } = u;
  let view: MapView | null = null;
  const refit = !prev || prev.key !== next.key || prev.w !== next.w || (prev.vh !== next.vh && !u.moved);
  if (refit) {
    view = fitRect(u.fit.rect, content, viewport, u.fit.pad, u.fit.max, u.fit.insets);
  } else if (prev.vh !== next.vh) {
    const mid = toMap({ x: next.w / 2, y: prev.vh / 2 }, content, u.view);
    view = centreOn(mid, { x: next.w / 2, y: next.vh / 2 }, u.view, content, viewport);
  }
  if (next.reveal && prev?.reveal !== next.reveal && u.revealPin) {
    const room: Box = { w: viewport.w, h: Math.max(viewport.h - u.revealInset, 1) };
    const base = view ?? u.view;
    // Clamped with the card's inset, so a pin near the map's bottom edge can still be lifted clear
    // of the card (the image's bottom then sits at the card's top, not the viewport's).
    if (!isVisible(u.revealPin, content, base, room, 32)) view = centreOn(u.revealPin, { x: next.w / 2, y: room.h / 2 }, base, content, { ...viewport, inset: u.revealInset });
  }
  return view ? { view, refit } : null;
}

/**
 * The pins to draw for a chip: every facility for "All" (null), else only that category's (see
 * matchesCategory). Ids in `keep` (the open facility, a route's ends) stay whatever the chip.
 */
export function pinsFor(facilities: Facility[], category: FacilityCategory | null, keep: (string | null | undefined)[] = []): Facility[] {
  return facilities.filter(f => matchesCategory(f, category) || keep.includes(f.id));
}

export type Compass = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
const COMPASS: Compass[] = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];

export interface Walk {
  /** The dashed line's ends, in content px. */
  line: { x1: number; y1: number; x2: number; y2: number };
  meters: number;
  minutes: number;
  steps: number;
  /** Which way to head first (maps are north up). */
  heading: Compass;
}

/** Paths wind round the bowl and the crowds, so a walk is longer than the straight line. */
const DETOUR = 1.3;
const METERS_PER_MINUTE = 75;
const METERS_PER_STEP = 0.75;

/**
 * The walk from one map point to another on an image `widthMeters` across: the straight dashed line
 * to draw, and an estimate of the real walk (distance, time, steps rounded to 10).
 * e.g. walkBetween({ x: 0.2, y: 0.5 }, { x: 0.4, y: 0.5 }, { w: 390, h: 390 }, 500) →
 *      line 78,195 → 156,195; 130 m; 2 min; 170 steps; heading 'e'
 */
export function walkBetween(from: MapPoint, to: MapPoint, content: Box, widthMeters: number): Walk {
  const mPerPx = widthMeters / content.w;
  const dx = (to.x - from.x) * content.w;
  const dy = (to.y - from.y) * content.h;
  const meters = Math.round(Math.hypot(dx, dy) * mPerPx * DETOUR);
  const angle = Math.atan2(dy, dx); // screen y points south
  const sector = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
  return {
    line: { x1: from.x * content.w, y1: from.y * content.h, x2: to.x * content.w, y2: to.y * content.h },
    meters,
    minutes: Math.max(1, Math.round(meters / METERS_PER_MINUTE)),
    steps: Math.max(10, Math.round(meters / METERS_PER_STEP / 10) * 10),
    heading: COMPASS[sector],
  };
}
