// Timing and geometry for LogoReveal (./logo-reveal.tsx), kept free of React so tests can check them.
// Figma names the animation "Logo • drawn-stroke reveal" (541:3687) but gives no timing; these are ours.

/** The outline draws on over this long, easing out. */
export const LOGO_DRAW_MS = 1200;
/** Then the gradient fill fades in over this long. */
export const LOGO_FILL_MS = 400;
/** The one-off reveal (role choice, landing) is done after this. */
export const LOGO_REVEAL_MS = LOGO_DRAW_MS + LOGO_FILL_MS;

// The waiting loop (Finding a Volunteer): draw, fill, hold, fade out, a short pause, again.
const LOOP_HOLD_MS = 1200;
const LOOP_FADE_MS = 400;
const LOOP_PAUSE_MS = 200;
/** One round of the waiting loop. */
export const LOGO_LOOP_MS = LOGO_REVEAL_MS + LOOP_HOLD_MS + LOOP_FADE_MS + LOOP_PAUSE_MS;

/**
 * How far along the logo is: `draw` (0–1, how much of each outline shows), `fill` (0–1, the gradient
 * fill's opacity) and `opacity` (0–1, the whole logo; only the loop fades out). Rounded to hundredths,
 * so a held frame compares equal and React skips the render.
 */
export interface LogoFrame {
  draw: number;
  fill: number;
  opacity: number;
}

export const LOGO_DONE: LogoFrame = { draw: 1, fill: 1, opacity: 1 };

const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const round = (x: number) => Math.round(x * 100) / 100;

/**
 * The frame `elapsed` ms in. `loop: false` stops on the finished logo; `loop: true` repeats every
 * LOGO_LOOP_MS. e.g. logoFrame(600) → { draw: 0.88, fill: 0, opacity: 1 }; logoFrame(5000) → LOGO_DONE;
 * logoFrame(3000, true) → fading out.
 */
export function logoFrame(elapsed: number, loop = false): LogoFrame {
  const t = loop ? ((elapsed % LOGO_LOOP_MS) + LOGO_LOOP_MS) % LOGO_LOOP_MS : Math.max(0, elapsed);
  const draw = round(easeOutCubic(clamp01(t / LOGO_DRAW_MS)));
  const fill = round(clamp01((t - LOGO_DRAW_MS) / LOGO_FILL_MS));
  const fadeStart = LOGO_REVEAL_MS + LOOP_HOLD_MS;
  const opacity = loop ? round(1 - clamp01((t - fadeStart) / LOOP_FADE_MS)) : 1;
  return { draw, fill, opacity };
}

/**
 * The length of an SVG path, in its own units, for the stroke-dash reveal. Knows M, L, H, V, C, Q and Z
 * (absolute or relative), which is what Figma exports; curves are measured as 32 straight pieces,
 * a hair short of the true length.
 * e.g. pathLength('M0 0L3 4') → 5; pathLength('M0 0H10V10H0Z') → 40.
 */
export function pathLength(d: string): number {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? [];
  let i = 0;
  let cmd = '';
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let total = 0;
  const num = () => Number(tokens[i++]);
  const lineTo = (nx: number, ny: number) => {
    total += Math.hypot(nx - x, ny - y);
    x = nx;
    y = ny;
  };
  const curve = (pts: number[][]) => {
    const all = [[x, y], ...pts];
    let px = x;
    let py = y;
    for (let s = 1; s <= 32; s++) {
      const [qx, qy] = bezierPoint(all, s / 32);
      total += Math.hypot(qx - px, qy - py);
      px = qx;
      py = qy;
    }
    const last = pts[pts.length - 1]!;
    x = last[0]!;
    y = last[1]!;
  };

  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i]!)) cmd = tokens[i++]!;
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    switch (cmd.toUpperCase()) {
      case 'M':
        x = ox + num();
        y = oy + num();
        startX = x;
        startY = y;
        cmd = rel ? 'l' : 'L'; // more pairs after M are lines
        break;
      case 'L':
        lineTo(ox + num(), oy + num());
        break;
      case 'H':
        lineTo(ox + num(), y);
        break;
      case 'V':
        lineTo(x, oy + num());
        break;
      case 'C':
        curve([[ox + num(), oy + num()], [ox + num(), oy + num()], [ox + num(), oy + num()]]);
        break;
      case 'Q':
        curve([[ox + num(), oy + num()], [ox + num(), oy + num()]]);
        break;
      case 'Z':
        lineTo(startX, startY);
        break;
      default:
        throw new Error(`pathLength: unsupported command "${cmd}"`);
    }
  }
  return total;
}

/** A point on a Bézier curve (any degree) at u, by de Casteljau. */
function bezierPoint(points: number[][], u: number): [number, number] {
  let pts = points.map(p => [p[0]!, p[1]!]);
  while (pts.length > 1) {
    pts = pts.slice(1).map((p, k) => [pts[k]![0]! + (p[0]! - pts[k]![0]!) * u, pts[k]![1]! + (p[1]! - pts[k]![1]!) * u]);
  }
  return [pts[0]![0]!, pts[0]![1]!];
}
