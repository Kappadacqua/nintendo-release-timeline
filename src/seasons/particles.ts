import { SEASONS } from "../timeline/config";
import type { Season } from "./season";

/**
 * Seasonal particles (no DOM): simple hollow shapes (outlines only), one colour per season,
 * drawn on one canvas, no images.
 * Speeds in px/s. Summer bubbles rise, spring petals drift diagonally while turning,
 * autumn leaves fall swaying, winter flakes fall slowly with a light drift.
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
      p.size = between(rand, 8, 26);
      // Small bubbles rise faster.
      p.vy = -between(rand, 18, 30) - (26 - p.size) * 0.75;
      p.freq = between(rand, 0.8, 1.6);
      p.sway = between(rand, 6, 14);
      if (!anywhere) p.y = height + p.size;
      break;
    case "spring":
      p.size = between(rand, 10, 18);
      p.vx = between(rand, 22, 40);
      p.vy = between(rand, 18, 30);
      p.spin = between(rand, 0.8, 2) * (rand() < 0.5 ? -1 : 1);
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
      p.size = between(rand, 14, 24);
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
      p.size = between(rand, 3, 8);
      // Bigger (closer) flakes fall a little faster.
      p.vy = between(rand, 9, 14) + p.size * 1.25;
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

/** Draws a particle's outline; the caller sets `globalAlpha`. */
export function drawParticle(ctx: CanvasRenderingContext2D, p: Particle, palette: Palette) {
  ctx.strokeStyle = palette[p.season];
  ctx.lineWidth = LINE;
  ctx.beginPath();
  switch (p.season) {
    case "summer": {
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      // Glint: a short arc inside, on the upper left.
      ctx.moveTo(p.x + Math.cos(Math.PI * 1.1) * p.size * 0.65, p.y + Math.sin(Math.PI * 1.1) * p.size * 0.65);
      ctx.arc(p.x, p.y, p.size * 0.65, Math.PI * 1.1, Math.PI * 1.4);
      break;
    }
    case "spring": {
      // Turning in 3D: the petal narrows and widens as it spins.
      const turn = 0.35 + 0.65 * Math.abs(Math.cos(p.angle * 1.3));
      ctx.ellipse(p.x, p.y, p.size, p.size * 0.55 * turn, p.angle, 0, Math.PI * 2);
      break;
    }
    case "autumn": {
      const s = p.size;
      const cos = Math.cos(p.angle);
      const sin = Math.sin(p.angle);
      // Leaf outline and midrib, in the leaf's own frame rotated by `angle`.
      const pt = (x: number, y: number): [number, number] => [p.x + x * cos - y * sin, p.y + x * sin + y * cos];
      ctx.moveTo(...pt(-s, 0));
      ctx.quadraticCurveTo(...pt(0, -s * 0.65), ...pt(s, 0));
      ctx.quadraticCurveTo(...pt(0, s * 0.65), ...pt(-s, 0));
      ctx.lineTo(...pt(s, 0));
      break;
    }
    case "winter": {
      // Six arms with a small ring in the middle.
      const r = p.size * 0.3;
      ctx.moveTo(p.x + r, p.y);
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      for (let i = 0; i < 3; i++) {
        const a = p.angle + (i * Math.PI) / 3;
        const dx = Math.cos(a) * p.size;
        const dy = Math.sin(a) * p.size;
        ctx.moveTo(p.x - dx, p.y - dy);
        ctx.lineTo(p.x + dx, p.y + dy);
      }
      break;
    }
  }
  ctx.stroke();
}
