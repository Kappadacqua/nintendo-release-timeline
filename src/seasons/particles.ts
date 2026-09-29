import { SEASONS } from "../timeline/config";
import type { Season } from "./season";

/**
 * Seasonal particles (no DOM): simple hollow shapes (outlines only), one colour per season,
 * drawn on one canvas, no images.
 * Speeds in px/s. Summer bubbles rise, spring petals (now and then a whole cherry blossom)
 * drift diagonally while turning, autumn maple leaves fall swaying, winter flakes fall slowly
 * with a light drift.
 */
export interface Particle {
  season: Season;
  x: number;
  y: number;
  /** Steady speed (px/s). */
  vx: number;
  vy: number;
  /** Radius or half length (px). */
  size: number;
  angle: number;
  /** Rotation speed (rad/s). */
  spin: number;
  /** Sway: phase (rad), frequency (rad/s) and amplitude (px/s). */
  phase: number;
  freq: number;
  sway: number;
  /** When it was born (ms): it fades in over `SEASONS.fadeInMs`. */
  born: number;
  /** Its season is over: fading out since then (ms), see `leaveFade`. */
  leftAt?: number;
  /** Spring only: a whole cherry blossom instead of a petal. */
  blossom?: boolean;
}

/** One colour per season. */
export type Palette = Record<Season, string>;

const between = (rand: () => number, lo: number, hi: number) => lo + (hi - lo) * rand();

/**
 * A new particle of `season` in a `width` × `height` window. `anywhere`: somewhere on screen
 * (a season arriving); otherwise just outside the edge it enters from (a particle reborn).
 */
export function spawnParticle(season: Season, width: number, height: number, now: number, anywhere: boolean, rand = Math.random): Particle {
  const p: Particle = {
    season,
    x: between(rand, 0, width),
    y: between(rand, 0, height),
    vx: 0,
    vy: 0,
    size: 0,
    angle: between(rand, 0, Math.PI * 2),
    spin: 0,
    phase: between(rand, 0, Math.PI * 2),
    freq: 0,
    sway: 0,
    born: now,
  };
  switch (season) {
    case "summer":
      p.size = between(rand, 14, 38);
      // Small bubbles rise faster.
      p.vy = -between(rand, 18, 30) - (38 - p.size) * 0.5;
      p.freq = between(rand, 0.8, 1.6);
      p.sway = between(rand, 6, 14);
      if (!anywhere) p.y = height + p.size;
      break;
    case "spring":
      p.blossom = rand() < SEASONS.blossomChance;
      p.size = p.blossom ? between(rand, 22, 30) : between(rand, 15, 26);
      p.vx = between(rand, 22, 40);
      p.vy = between(rand, 18, 30);
      // A blossom is heavier: it turns and drifts more slowly.
      p.spin = between(rand, 0.8, 2) * (rand() < 0.5 ? -1 : 1) * (p.blossom ? 0.35 : 1);
      if (p.blossom) p.vx *= 0.6;
      p.freq = between(rand, 1.5, 3);
      p.sway = 6;
      if (!anywhere) {
        // From the top edge, or from the left one (the diagonal enters there too).
        if (rand() < 0.6) {
          p.x = between(rand, -width * 0.2, width);
          p.y = -p.size * 2;
        } else {
          p.x = -p.size * 2;
          p.y = between(rand, 0, height * 0.8);
        }
      }
      break;
    case "autumn":
      p.size = between(rand, 22, 36);
      p.vx = between(rand, -4, 8);
      p.vy = between(rand, 18, 32);
      p.freq = between(rand, 0.8, 1.4);
      p.sway = between(rand, 20, 34);
      if (!anywhere) {
        p.x = between(rand, -width * 0.05, width * 1.05);
        p.y = -p.size * 2;
      }
      break;
    case "winter":
      p.size = between(rand, 7, 15);
      // Bigger (closer) flakes fall a little faster.
      p.vy = between(rand, 8, 12) + p.size * 0.5;
      p.vx = between(rand, 2, 8);
      p.freq = between(rand, 0.3, 0.7);
      p.sway = between(rand, 4, 9);
      p.spin = between(rand, -0.4, 0.4);
      if (!anywhere) {
        p.x = between(rand, -width * 0.1, width);
        p.y = -p.size * 2;
      }
      break;
  }
  return p;
}

/** Moves a particle by `dt` seconds; `t` is the time in seconds (for the sway). */
export function stepParticle(p: Particle, dt: number, t: number) {
  const wave = Math.sin(t * p.freq + p.phase);
  p.x += (p.vx + wave * p.sway) * dt;
  p.y += p.vy * dt;
  if (p.season === "autumn") {
    // A leaf tilts with its sway, like a pendulum.
    p.angle = wave * 0.7 + p.phase;
  } else {
    p.angle += p.spin * dt;
  }
}

/** Out of the window for good (past the edge it moves toward)? */
export function isGone(p: Particle, width: number, height: number) {
  const m = p.size * 3 + 20;
  if (p.season === "summer") return p.y < -m;
  return p.y > height + m || p.x > width + m || p.x < -width * 0.3 - m;
}

/** 0 → 1 over `SEASONS.fadeInMs` from birth. */
export function fadeIn(p: Particle, now: number) {
  return Math.min(1, Math.max(0, (now - p.born) / SEASONS.fadeInMs));
}

/** Outline width (px) of every particle. */
const LINE = 1.5;

/**
 * Right half of a maple leaf (x ≥ 0), from the top tip to the stem, for a leaf of half
 * height 1 pointing up: three lobes with a few teeth. The left half is its mirror image.
 */
const MAPLE: readonly [number, number][] = [
  [0, -1],
  [0.1, -0.74],
  [0.22, -0.8],
  [0.17, -0.56],
  [0.14, -0.36],
  [0.5, -0.6],
  [0.52, -0.5],
  [0.9, -0.52],
  [0.74, -0.32],
  [0.86, -0.22],
  [0.6, -0.1],
  [0.4, -0.02],
  [0.62, 0.26],
  [0.36, 0.2],
  [0.24, 0.3],
  [0.05, 0.42],
];
/** Where the veins of the maple leaf end: top, side and lower lobes (right half). */
const MAPLE_VEINS: readonly [number, number][] = [
  [0, -0.82],
  [0.74, -0.44],
  [0.48, 0.18],
];

function mapleLeaf(ctx: CanvasRenderingContext2D, s: number) {
  ctx.moveTo(0, -s);
  for (const [x, y] of MAPLE) ctx.lineTo(x * s, y * s);
  for (let i = MAPLE.length - 1; i >= 0; i--) ctx.lineTo(-MAPLE[i][0] * s, MAPLE[i][1] * s);
  ctx.closePath();
  // Stem and veins, from the base of the blade.
  ctx.moveTo(0, 0.85 * s);
  ctx.lineTo(0, 0.3 * s);
  for (const [x, y] of MAPLE_VEINS) {
    for (const side of x ? [1, -1] : [1]) {
      ctx.moveTo(0, 0.3 * s);
      ctx.lineTo(side * x * s, y * s);
    }
  }
}

/** A petal pointing up from the origin, `r` long and `w` · r wide, with the cherry notch at its tip. */
function petal(ctx: CanvasRenderingContext2D, r: number, w = 0.6) {
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-w * r, -0.45 * r, -0.44 * w * r, -r);
  ctx.lineTo(0, -0.84 * r);
  ctx.lineTo(0.44 * w * r, -r);
  ctx.quadraticCurveTo(w * r, -0.45 * r, 0, 0);
}

/** Five notched petals around a small centre with three stamens. */
function blossom(ctx: CanvasRenderingContext2D, r: number) {
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI * 2) / 5);
    // Narrower than a single petal, so the five just touch.
    petal(ctx, r, 0.42);
    ctx.restore();
  }
  ctx.moveTo(r * 0.14, 0);
  ctx.arc(0, 0, r * 0.14, 0, Math.PI * 2);
  for (let i = 0; i < 5; i++) {
    const a = ((i + 0.5) * Math.PI * 2) / 5;
    ctx.moveTo(Math.cos(a) * r * 0.14, Math.sin(a) * r * 0.14);
    ctx.lineTo(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42);
  }
}

/** Six arms, each with a pair of small branches, around a small hexagon. */
function snowflake(ctx: CanvasRenderingContext2D, s: number) {
  const b = s * 0.3;
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const c = Math.cos(a);
    const d = Math.sin(a);
    const at = (along: number, across: number): [number, number] => [c * along - d * across, d * along + c * across];
    ctx.moveTo(...at(s * 0.2, 0));
    ctx.lineTo(...at(s, 0));
    ctx.moveTo(...at(s * 0.55 + b, b));
    ctx.lineTo(...at(s * 0.55, 0));
    ctx.lineTo(...at(s * 0.55 + b, -b));
    // Side of the central hexagon.
    const n = ((i + 1) * Math.PI) / 3;
    ctx.moveTo(c * s * 0.2, d * s * 0.2);
    ctx.lineTo(Math.cos(n) * s * 0.2, Math.sin(n) * s * 0.2);
  }
}

/** Draws a particle's outline; the caller sets `globalAlpha`. */
export function drawParticle(ctx: CanvasRenderingContext2D, p: Particle, palette: Palette) {
  ctx.strokeStyle = palette[p.season];
  ctx.lineWidth = LINE;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.beginPath();
  switch (p.season) {
    case "summer": {
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      // Glints: a short arc inside on the upper left, a smaller one opposite.
      ctx.moveTo(Math.cos(Math.PI * 1.1) * p.size * 0.68, Math.sin(Math.PI * 1.1) * p.size * 0.68);
      ctx.arc(0, 0, p.size * 0.68, Math.PI * 1.1, Math.PI * 1.45);
      ctx.moveTo(Math.cos(Math.PI * 0.15) * p.size * 0.72, Math.sin(Math.PI * 0.15) * p.size * 0.72);
      ctx.arc(0, 0, p.size * 0.72, Math.PI * 0.15, Math.PI * 0.25);
      break;
    }
    case "spring": {
      ctx.rotate(p.angle);
      if (p.blossom) {
        // A blossom tilts a little as it turns, never edge-on.
        ctx.scale(1, 0.75 + 0.25 * Math.cos(p.angle * 1.3));
        blossom(ctx, p.size);
      } else {
        // Turning in 3D: the petal narrows and widens as it spins.
        ctx.scale(0.35 + 0.65 * Math.abs(Math.cos(p.angle * 1.3)), 1);
        ctx.translate(0, p.size / 2);
        petal(ctx, p.size);
      }
      break;
    }
    case "autumn": {
      ctx.rotate(p.angle);
      mapleLeaf(ctx, p.size);
      break;
    }
    case "winter": {
      ctx.rotate(p.angle);
      snowflake(ctx, p.size);
      break;
    }
  }
  ctx.restore();
  // Stroked after restore: the line keeps its width however the shape was scaled.
  ctx.stroke();
}
