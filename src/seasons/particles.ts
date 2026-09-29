import { SEASONS } from "../timeline/config";
import type { Season } from "./season";

/**
 * Seasonal particles (no DOM): simple shapes drawn on one canvas, no images.
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
  /** Which colour of the season's palette. */
  tone: number;
  /** When it was born (ms): it fades in over `SEASONS.fadeInMs`. */
  born: number;
}

export type Palette = Record<Season, string[]>;

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
    tone: Math.floor(rand() * 3),
    born: now,
  };
  switch (season) {
    case "summer":
      p.size = between(rand, 4, 13);
      // Small bubbles rise faster.
      p.vy = -between(rand, 18, 30) - (13 - p.size) * 1.5;
      p.freq = between(rand, 0.8, 1.6);
      p.sway = between(rand, 6, 14);
      if (!anywhere) p.y = height + p.size;
      break;
    case "spring":
      p.size = between(rand, 5, 9);
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
      p.size = between(rand, 7, 12);
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
      p.size = between(rand, 1.5, 4);
      // Bigger (closer) flakes fall a little faster.
      p.vy = between(rand, 9, 14) + p.size * 2.5;
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

/** Draws a particle; the caller sets `globalAlpha`. */
export function drawParticle(ctx: CanvasRenderingContext2D, p: Particle, palette: Palette) {
  const colors = palette[p.season];
  const color = colors[p.tone % colors.length];
  ctx.fillStyle = ctx.strokeStyle = color;
  switch (p.season) {
    case "summer": {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // Glint on the upper left.
      ctx.beginPath();
      ctx.arc(p.x - p.size * 0.35, p.y - p.size * 0.35, Math.max(1, p.size * 0.18), 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "spring": {
      // Turning in 3D: the petal narrows and widens as it spins.
      const turn = 0.35 + 0.65 * Math.abs(Math.cos(p.angle * 1.3));
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.55 * turn, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
    case "autumn": {
      const s = p.size;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.beginPath();
      ctx.moveTo(-s, 0);
      ctx.quadraticCurveTo(0, -s * 0.65, s, 0);
      ctx.quadraticCurveTo(0, s * 0.65, -s, 0);
      ctx.fill();
      ctx.restore();
      break;
    }
    case "winter": {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      // Bigger flakes get six thin arms.
      if (p.size > 3) {
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const a = p.angle + (i * Math.PI) / 3;
          const dx = Math.cos(a) * p.size * 2;
          const dy = Math.sin(a) * p.size * 2;
          ctx.moveTo(p.x - dx, p.y - dy);
          ctx.lineTo(p.x + dx, p.y + dy);
        }
        ctx.stroke();
      }
      break;
    }
  }
}
