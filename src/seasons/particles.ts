import { isVerticalSize } from "../layout";
import { SEASONS } from "../timeline/config";
import type { Season } from "./season";

/**
 * Seasonal particles (no DOM): the motion of each particle; its look is a pre-rendered sprite
 * (`sprites.ts`), one colour per season. Speeds in px/s. Summer bubbles and bubble clusters rise
 * while scallop shells and starfish sink slowly, spring petals, tiny
 * buds, whole cherry blossoms and now and then a flowering sprig drift diagonally, autumn leaves
 * (four species) and winter snow (flakes, plates, soft dots, now and then a fir twig) fall, pushed
 * sideways by gusts. A wheel spin pushes every particle sideways for a moment (`WheelPush`).
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

export type Kind = "bubble" | "cluster" | "shell" | "starfish" | "petal" | "blossom" | "sprig" | "bud" | "maple" | "oak" | "birch" | "ginkgo" | "dendrite" | "plate" | "dot" | "fir";

/** Rare kinds have fewer sprite variants. */
export const RARE_KINDS: ReadonlySet<Kind> = new Set(["sprig", "fir", "starfish"]);

/** Kinds that only live in some depth bands (the others live in all three). */
export const KIND_BANDS: Partial<Record<Kind, readonly number[]>> = {
  dot: [0],
  fir: [1, 2],
  blossom: [1, 2],
  sprig: [1],
  bud: [0],
  cluster: [1, 2],
  shell: [1, 2],
  starfish: [1, 2],
};

/** Kinds kept to some bands with their own split between them (else split by the band shares). */
const KIND_BAND_SPLIT: Partial<Record<Kind, readonly number[]>> = {
  fir: SEASONS.winter.fir.bandSplit,
};

/** Half of the longest side of a bubble cluster, in radii of its biggest bubble (3–5 stacked). */
export const CLUSTER_SPAN = 3;

/** Radius or half length (px) of each kind in the middle band at 1080p. */
export const KIND_SIZE: Record<Kind, number> = {
  // Summer: bubbles 56 px across, a cluster's biggest bubble 40 px, shells 60 px wide (middle band);
  // starfish 64 / 96 px across, see `KIND_BAND_SIZE`.
  bubble: 28,
  cluster: 20 * CLUSTER_SPAN,
  shell: 30,
  starfish: 32,
  // Spring: petals 28 px long, blossoms 60 px across, a sprig 110 px long (middle band);
  // buds 10 px long in the far band.
  petal: 14,
  blossom: 30,
  sprig: 55,
  bud: 5 / SEASONS.bands[0].size,
  // Leaves: half of their length L (56 px in the middle band).
  maple: 28,
  oak: 28,
  birch: 28,
  ginkgo: 28,
  // Winter: diameters 36 and 30 px, a twig 70 px long (middle band; 105 px in the near one).
  dendrite: 18,
  plate: 15,
  dot: SEASONS.winter.dotRadiusPx[1],
  fir: 35,
};

/** Kinds whose size per band is not the band's size × the middle one: radius (px at 1080p) per band. */
const KIND_BAND_SIZE: Partial<Record<Kind, readonly number[]>> = {
  starfish: [32, 32, 48],
  fir: [35, 35, 52.5],
};

/** Radius or half length (px at 1080p) of a kind in a band; soft dots keep their size in every band. */
export function kindRadius(kind: Kind, depth: number) {
  if (kind === "dot") return KIND_SIZE.dot;
  return KIND_BAND_SIZE[kind]?.[depth] ?? KIND_SIZE[kind] * SEASONS.bands[depth].size;
}

/** Summer elements that sink instead of rising. */
export const SINKING: ReadonlySet<Kind> = new Set(["shell", "starfish"]);

/** Every kind a season draws. */
export const SEASON_KINDS: Record<Season, readonly Kind[]> = {
  winter: ["dendrite", "plate", "dot", "fir"],
  spring: ["petal", "blossom", "sprig", "bud"],
  summer: ["bubble", "cluster", "shell", "starfish"],
  autumn: ["maple", "oak", "birch", "ginkgo"],
};

/** One colour per season. */
export type Palette = Record<Season, string>;

const between = (rand: () => number, lo: number, hi: number) => lo + (hi - lo) * rand();

/**
 * Size factor of the window: `innerHeight / 1080`, clamped. Phones (the vertical timeline's sizes, SPEC
 * "Mobile"): the screen's short side / `phoneViewPx`, from `phoneViewScale` up to the usual minimum,
 * so a leaf stays small next to a 360 px wide timeline.
 */
export function viewScale(height: number, width = Infinity) {
  const [lo, hi] = SEASONS.viewScale;
  if (isVerticalSize(width, height)) return Math.min(lo, Math.max(SEASONS.phoneViewScale, Math.min(width, height) / SEASONS.phoneViewPx));
  return Math.min(hi, Math.max(lo, height / SEASONS.viewHeight));
}

/** Share of each kind among a season's new particles. */
function kindShares(season: Season): Partial<Record<Kind, number>> {
  switch (season) {
    case "spring":
      return SEASONS.spring.shares;
    case "autumn":
      return SEASONS.leaves.shares;
    case "winter":
      return SEASONS.winter.shares;
    case "summer":
      return SEASONS.summer.shares;
  }
}

/** Index picked by `weights` (not necessarily summing to 1). */
function pick(weights: readonly number[], rand: () => number) {
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = rand() * sum;
  for (let i = 0; i < weights.length - 1; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

/**
 * Weight of each depth band for a new particle of `kind`. A kind kept to some bands fills part of
 * them, split by the band shares; the free kinds share what is left, so the season as a whole
 * keeps the band shares.
 */
export function depthWeights(season: Season, kind: Kind): number[] {
  const shares = kindShares(season);
  return SEASONS.bands.map((band, depth) => {
    if (KIND_BANDS[kind]) return keptShare(kind, depth);
    let left = band.share;
    for (const [k, share] of Object.entries(shares) as [Kind, number][]) {
      if (KIND_BANDS[k]) left -= share * keptShare(k, depth);
    }
    return Math.max(0, left);
  });
}

/** Share of a kind kept to some bands that goes to `depth` (`KIND_BAND_SPLIT`, else by the band shares). */
function keptShare(kind: Kind, depth: number) {
  const only = KIND_BANDS[kind]!;
  if (!only.includes(depth)) return 0;
  const split = KIND_BAND_SPLIT[kind];
  if (split) return split[depth];
  return SEASONS.bands[depth].share / only.reduce((sum, d) => sum + SEASONS.bands[d].share, 0);
}

/** Kind of a new particle of `season`, by its share. */
function pickKind(season: Season, rand: () => number): Kind {
  const entries = Object.entries(kindShares(season)) as [Kind, number][];
  return entries[pick(entries.map(([, share]) => share), rand)][0];
}

export function variantCount(kind: Kind) {
  return RARE_KINDS.has(kind) ? SEASONS.variants.rare : SEASONS.variants.common;
}

/**
 * A new particle of `season` in a `width` × `height` window. `anywhere`: somewhere on screen
 * (a season arriving); otherwise just outside the edge it enters from (a particle reborn).
 */
export function spawnParticle(season: Season, width: number, height: number, now: number, anywhere: boolean, rand = Math.random): Particle {
  const view = viewScale(height, width);
  const kind = pickKind(season, rand);
  const depth = pick(depthWeights(season, kind), rand);
  const band = SEASONS.bands[depth];
  // Leaves, spring elements (and the fir twig) sway wider than the other elements; in summer
  // what rises sways quick and narrow, what sinks slow and wide.
  const wobble: { ampPx: readonly [number, number]; periodS: readonly [number, number] } =
    season === "autumn"
      ? SEASONS.leaves
      : season === "spring"
        ? SEASONS.spring
        : season === "summer"
          ? SINKING.has(kind)
            ? SEASONS.summer.sink
            : SEASONS.summer.rise
          : { ampPx: kind === "fir" ? SEASONS.winter.fir.ampPx : SEASONS.wobbleAmpPx, periodS: SEASONS.wobblePeriodS };
  // Soft dots take their size from their sprite variant alone.
  const scale = kind === "dot" ? 1 : between(rand, 1 - SEASONS.sizeJitter, 1 + SEASONS.sizeJitter);
  // Bubbles stay upright: their glints keep the light from the upper left, a cluster stays a column.
  const upright = kind === "bubble" || kind === "cluster";
  const tilt = upright ? 0 : (between(rand, -1, 1) * SEASONS.tiltDeg * Math.PI) / 180;
  const p: Particle = {
    season,
    kind,
    variant: Math.floor(rand() * variantCount(kind)),
    depth,
    x: between(rand, 0, width),
    y: between(rand, 0, height),
    vx: 0,
    vy: 0,
    size: kindRadius(kind, depth) * view * scale,
    scale,
    cos: Math.cos(tilt),
    sin: Math.sin(tilt),
    amp: between(rand, ...wobble.ampPx) * view,
    omega: (Math.PI * 2) / between(rand, ...wobble.periodS),
    phase: between(rand, 0, Math.PI * 2),
    born: now,
  };
  // Base speeds are those of the middle band; the band multiplies them.
  switch (season) {
    case "summer":
      p.vy = -between(rand, 18, 30) - between(rand, 0, 12);
      if (SINKING.has(kind)) {
        // Shells and starfish sink slowly from the top edge.
        p.vy *= -SEASONS.summer.sink.speed;
        if (!anywhere) p.y = -p.size * 2;
      } else if (!anywhere) p.y = height + p.size;
      break;
    case "spring":
      p.vx = between(rand, 22, 40);
      p.vy = between(rand, 18, 30);
      // A blossom is heavier: it drifts more slowly.
      if (kind === "blossom") {
        p.vx *= SEASONS.spring.blossomSpeed;
        p.vy *= SEASONS.spring.blossomSpeed;
      }
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
      p.vx *= SEASONS.winter.speed;
      p.vy *= SEASONS.winter.speed;
      if (kind === "fir") {
        p.vx *= SEASONS.winter.fir.speed;
        p.vy *= SEASONS.winter.fir.speed;
      }
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

/** Moves a particle by `dt` seconds, `gust` px/s more sideways (the wobble is added when drawn, see `wobbleX`). */
export function stepParticle(p: Particle, dt: number, gust = 0) {
  p.x += (p.vx + gust) * dt;
  p.y += p.vy * dt;
}

/** Drawn x at time `t` (s): the position plus the sideways wobble. */
export function wobbleX(p: Particle, t: number) {
  return p.x + p.amp * Math.sin(p.omega * t + p.phase);
}

/** Out of the window for good (past the edge it moves toward)? */
export function isGone(p: Particle, width: number, height: number) {
  const m = p.size * 3 + 20 + p.amp;
  // Rising (summer bubbles): gone past the top edge.
  if (p.vy < 0) return p.y < -m;
  return p.y > height + m || p.x > width + m || p.x < -width * 0.3 - m;
}

/** 0 → 1 over `SEASONS.fadeInMs` from birth. */
export function fadeIn(p: Particle, now: number) {
  return Math.min(1, Math.max(0, (now - p.born) / SEASONS.fadeInMs));
}

/**
 * Winter gusts: now and then (every `SEASONS.winter.gust.everyS`) a sideways push common to every
 * particle of a band, of random sign, rising and falling over `durationS`. Each band has its own.
 */
export class Gusts {
  private readonly start: number[];
  private readonly sign: number[];

  constructor(
    now: number,
    private rand = Math.random,
  ) {
    this.start = SEASONS.bands.map(() => now + this.gap());
    this.sign = SEASONS.bands.map(() => this.side());
  }

  /** Extra sideways speed (px/s) of the particles of band `depth` at `now` (ms). */
  velocity(depth: number, now: number) {
    const { pxPerS, durationS } = SEASONS.winter.gust;
    const duration = durationS * 1000;
    // Past gusts make room for the next one.
    while (now >= this.start[depth] + duration) {
      this.start[depth] += this.gap();
      this.sign[depth] = this.side();
    }
    if (now < this.start[depth]) return 0;
    const u = (now - this.start[depth]) / duration;
    return this.sign[depth] * pxPerS * Math.sin(Math.PI * u) ** 2;
  }

  private gap() {
    return between(this.rand, ...SEASONS.winter.gust.everyS) * 1000;
  }

  private side() {
    return this.rand() < 0.5 ? -1 : 1;
  }
}

/**
 * Push of a wheel spin (`SEASONS.react`): each notch of a continuous spin adds a fixed sideways
 * speed, summed with what is left of the previous ones and decaying exponentially.
 * Near particles move more than far ones; none faster than `maxPxPerS`.
 */
export class WheelPush {
  /** Push (px/s, before the band's factor) at time `at` (ms). */
  private speed = 0;
  private at = 0;

  /** A spin notch in direction `dir` (+1 forward in time) at `now` (ms). */
  notch(dir: 1 | -1, now: number) {
    const { sign, gainPxPerS, maxPxPerS } = SEASONS.react;
    const speed = this.base(now) + sign * dir * gainPxPerS;
    this.speed = Math.max(-maxPxPerS, Math.min(maxPxPerS, speed));
    this.at = now;
  }

  /** Extra sideways speed (px/s) of the particles of band `depth` at `now` (ms). */
  velocity(depth: number, now: number) {
    const { bandFactor, maxPxPerS } = SEASONS.react;
    const v = this.base(now) * bandFactor[depth];
    return Math.max(-maxPxPerS, Math.min(maxPxPerS, v));
  }

  /** Forget any push (reduced motion, background hidden). */
  clear() {
    this.speed = 0;
  }

  private base(now: number) {
    if (!this.speed) return 0;
    return this.speed * Math.exp(-Math.max(0, now - this.at) / SEASONS.react.decayMs);
  }
}
