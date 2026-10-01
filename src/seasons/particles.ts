import { SEASONS } from "../timeline/config";
import type { Season } from "./season";

/**
 * Seasonal particles (no DOM): the motion of each particle; its look is a pre-rendered sprite
 * (`sprites.ts`), one colour per season. Speeds in px/s. Summer bubbles rise, spring petals (now
 * and then a whole cherry blossom) drift diagonally, autumn maple leaves and winter flakes fall.
 * No particle ever turns: its tilt is chosen once, and it only moves and wobbles sideways.
 */
export interface Particle {
  season: Season;
  kind: Kind;
  /** Sprite variant (0 … variants of its kind − 1). */
  variant: number;
  /** Depth band: 0 far, 1 middle, 2 near (`SEASONS.bands`). */
  depth: number;
  /** Position without the wobble (px). */
  x: number;
  y: number;
  /** Steady speed (px/s). */
  vx: number;
  vy: number;
  /** Radius or half length on screen (px), for the window edges. */
  size: number;
  /** Drawn size relative to its band's sprite (± `SEASONS.sizeJitter`). */
  scale: number;
  /** Fixed tilt, as cosine and sine. */
  cos: number;
  sin: number;
  /** Wobble: amplitude (px), angular frequency (rad/s) and phase (rad). */
  amp: number;
  omega: number;
  phase: number;
  /** When it was born (ms): it fades in over `SEASONS.fadeInMs`. */
  born: number;
}

export type Kind = "bubble" | "petal" | "blossom" | "leaf" | "flake";

/** Rare kinds have fewer sprite variants. */
export const RARE_KINDS: ReadonlySet<Kind> = new Set(["blossom"]);

/** Radius or half length (px) of each kind in the middle band at 1080p. */
export const KIND_SIZE: Record<Kind, number> = { bubble: 26, petal: 20, blossom: 26, leaf: 29, flake: 11 };

/** Every kind a season draws. */
export const SEASON_KINDS: Record<Season, readonly Kind[]> = {
  winter: ["flake"],
  spring: ["petal", "blossom"],
  summer: ["bubble"],
  autumn: ["leaf"],
};

/** One colour per season. */
export type Palette = Record<Season, string>;

const between = (rand: () => number, lo: number, hi: number) => lo + (hi - lo) * rand();

/** Size factor of the window: `innerHeight / 1080`, clamped. */
export function viewScale(height: number) {
  const [lo, hi] = SEASONS.viewScale;
  return Math.min(hi, Math.max(lo, height / SEASONS.viewHeight));
}

/** Depth band of a new particle, by the band shares. */
function pickDepth(rand: () => number) {
  let r = rand();
  for (let i = 0; i < SEASONS.bands.length - 1; i++) {
    r -= SEASONS.bands[i].share;
    if (r < 0) return i;
  }
  return SEASONS.bands.length - 1;
}

export function variantCount(kind: Kind) {
  return RARE_KINDS.has(kind) ? SEASONS.variants.rare : SEASONS.variants.common;
}

/**
 * A new particle of `season` in a `width` × `height` window. `anywhere`: somewhere on screen
 * (a season arriving); otherwise just outside the edge it enters from (a particle reborn).
 */
export function spawnParticle(season: Season, width: number, height: number, now: number, anywhere: boolean, rand = Math.random): Particle {
  const view = viewScale(height);
  const depth = pickDepth(rand);
  const band = SEASONS.bands[depth];
  const kind: Kind = season === "spring" && rand() < SEASONS.blossomChance ? "blossom" : SEASON_KINDS[season][0];
  const scale = between(rand, 1 - SEASONS.sizeJitter, 1 + SEASONS.sizeJitter);
  const tilt = (between(rand, -1, 1) * SEASONS.tiltDeg * Math.PI) / 180;
  const p: Particle = {
    season,
    kind,
    variant: Math.floor(rand() * variantCount(kind)),
    depth,
    x: between(rand, 0, width),
    y: between(rand, 0, height),
    vx: 0,
    vy: 0,
    size: KIND_SIZE[kind] * band.size * view * scale,
    scale,
    cos: Math.cos(tilt),
    sin: Math.sin(tilt),
    amp: between(rand, ...SEASONS.wobbleAmpPx) * view,
    omega: (Math.PI * 2) / between(rand, ...SEASONS.wobblePeriodS),
    phase: between(rand, 0, Math.PI * 2),
    born: now,
  };
  // Base speeds are those of the middle band; the band multiplies them.
  switch (season) {
    case "summer":
      p.vy = -between(rand, 18, 30) - between(rand, 0, 12);
      if (!anywhere) p.y = height + p.size;
      break;
    case "spring":
      p.vx = between(rand, 22, 40);
      p.vy = between(rand, 18, 30);
      // A blossom is heavier: it drifts more slowly.
      if (kind === "blossom") p.vx *= 0.6;
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
      p.vx = between(rand, -4, 8);
      p.vy = between(rand, 18, 32);
      if (!anywhere) {
        p.x = between(rand, -width * 0.05, width * 1.05);
        p.y = -p.size * 2;
      }
      break;
    case "winter":
      p.vy = between(rand, 11.5, 19.5);
      p.vx = between(rand, 2, 8);
      if (!anywhere) {
        p.x = between(rand, -width * 0.1, width);
        p.y = -p.size * 2;
      }
      break;
  }
  p.vx *= band.speed;
  p.vy *= band.speed;
  return p;
}

/** Moves a particle by `dt` seconds (the wobble is added when drawn, see `wobbleX`). */
export function stepParticle(p: Particle, dt: number) {
  p.x += p.vx * dt;
  p.y += p.vy * dt;
}

/** Drawn x at time `t` (s): the position plus the sideways wobble. */
export function wobbleX(p: Particle, t: number) {
  return p.x + p.amp * Math.sin(p.omega * t + p.phase);
}

/** Out of the window for good (past the edge it moves toward)? */
export function isGone(p: Particle, width: number, height: number) {
  const m = p.size * 3 + 20 + p.amp;
  if (p.season === "summer") return p.y < -m;
  return p.y > height + m || p.x > width + m || p.x < -width * 0.3 - m;
}

/** 0 → 1 over `SEASONS.fadeInMs` from birth. */
export function fadeIn(p: Particle, now: number) {
  return Math.min(1, Math.max(0, (now - p.born) / SEASONS.fadeInMs));
}
