export const TIMELINE = {
  // Scale per zoom level (32px per day at Day level) and Shift + arrow steps: see zoom.ts.
  /** Switch 2 launch: first day on the line. */
  startDate: "2025-06-05",
  /** Days of line drawn after the last precise release date (or today, if later). */
  endMarginDays: 60,
  /** A wheel event at least this big (px) is one mouse-wheel notch = one day. */
  wheelNotchPx: 40,
  /** Pixels per notch when the browser merges several notches into one event. */
  wheelNotchUnitPx: 100,
  /** Trackpad: small deltas add up to this many px before moving one day. */
  trackpadDayPx: 40,
  /** Trackpad with Shift: this many px per month. */
  trackpadMonthPx: 160,
  /** Day numbers are printed under the ticks of these days of the month. */
  labeledDays: [1, 5, 10, 15, 20, 25],
  /** Fraction of the remaining distance covered per 60fps frame (lower = more inertia). */
  smoothing: 0.16,
  /** Jumps longer than this (px) glide in a fixed time instead of chasing the target… */
  glideMinPx: 300,
  /** …and never take longer than this. */
  maxGlideMs: 600,
  /** Drag inertia (ITERATION-4 §10): speed kept per 60fps frame (lower = more friction). */
  flingFriction: 0.94,
  /** Below this release speed (px/ms) a drag just snaps: no inertia from a slow or tiny move. */
  flingMinVelocity: 0.35,
  /** However fast the flick, inertia never travels more than this many days (at any zoom). */
  flingMaxDays: 30,
  /** Inertia ends (and snaps) once it slows below this speed (px/ms). */
  flingStopVelocity: 0.08,

  /**
   * Mouse-wheel gears, chosen by how long the wheel has been spinning without a pause.
   * Notches less than this far apart (ms) are one continuous spin; a longer pause starts afresh in gear 1…
   */
  wheelGearGapMs: 150,
  /** …and a notch further than this (ms) from the previous one (the pace slows) drops one gear. */
  wheelGearSlowGapMs: 100,
  /** Gears 2 and 3 start after this long of continuous spin (ms). */
  wheelGearStartMs: [300, 800],
  /** Units (days, weeks, months) per notch in gears 1, 2, 3. */
  wheelGearUnits: [1, 3, 7],
  /** Most units the view coasts past the last notch in gears 1, 2, 3 (gear 1: none, it just snaps). */
  wheelGearInertiaUnits: [0, 7, 30],
  /** Speed kept per 60fps frame while a wheel fling slows down (same as a drag's `flingFriction`). */
  wheelFlingFriction: 0.94,
  /** A continuous spin (notches + inertia) never moves further than this many days (about 3 months, at any zoom). */
  wheelFlingMaxDays: 91,
  /** A wheel fling that would stop within this many units of a release lands on it. */
  wheelMagnetUnits: 2,
  /** After a trackpad-like event (small delta), wheel events never fling for this long. */
  wheelTrackpadHoldMs: 400,

  /** Distance from the line to the nearest card: the band for day numbers and months, never scaled. */
  cardOffset: 64,
  /** Stacked cards: each extra level moves this far out and sideways. */
  stackStepY: 56,
  stackStepX: 22,
  /** Minimum horizontal gap between cards in the same lane. */
  laneGap: 16,
  /** A card may slide sideways up to this fraction of its width before stacking. */
  maxShift: 0.6,
  /** Cards further than this beyond the viewport edges are not rendered. */
  cullMarginPx: 400,

  /** Empty space between the end of the dated line and the TBA zone. */
  tbaGapPx: 240,
  /** Height reserved at the bottom for the minimap; the line is centered above it. */
  minimapBandPx: 64,
  /** Tallest card (game with scores and a 3-line title), used to fit cards to short windows. */
  cardMaxHeight: 272,
  /** Tallest compact card (cover, title, badges). */
  compactCardMaxHeight: 124,
  /** Zoomed-out card: the cover alone. */
  coverCardMaxHeight: 100,
  /** Ctrl + wheel: at most one zoom level per this many ms (trackpad pinches send bursts). */
  zoomCooldownMs: 350,
  /** Trackpad pinch: this many px of Ctrl + wheel delta make one zoom step. */
  zoomPinchPx: 60,
  /** Presentation mode (ITERATION-4 §9): seconds on each game. */
  presentationSeconds: 6,
  /** Presentation: the pointer hides after this long without moving. */
  presentationCursorMs: 2500,
  /** Cards never shrink below this scale on short windows. */
  minCardScale: 0.55,
};

/** Seasonal background (docs/tasks/seasons.md): timings, density and what counts as fast scrolling. */
export const SEASONS = {
  /** A new particle fades in over this long (it never pops up). */
  fadeInMs: 800,
  /**
   * Cross-fade at a season change (docs/tasks/seasons-art.md task 2): the new season's weight
   * rises to 1 after `crossDelayMs`, over `crossInMs`; the others sink to 0 over `crossOutMs`.
   * A season's particles: target × weight, their opacity × weight.
   */
  crossDelayMs: 300,
  crossInMs: 2000,
  crossOutMs: 1500,
  /** All seasons together never draw more than this × the target number of particles. */
  crossCap: 1.3,
  /** After fast scrolling the background comes back this long after the timeline stopped (fades: tokens.css). */
  restMs: 500,
  /** Particles at the smallest and largest window area. */
  minParticles: 20,
  maxParticles: 40,
  /** Window areas (px²) of those counts: 1280 × 720 and 2560 × 1440. */
  minArea: 1280 * 720,
  maxArea: 2560 * 1440,
  /**
   * Spring (docs/tasks/seasons-art.md task 5): share of each element, a wider sideways wobble
   * (px at 1080p, s), the two fill opacities of a single petal (per variant), the blossom's
   * slowness, the sprig's branch width (px) and its small flowers (× the blossom's size).
   */
  spring: {
    shares: { petal: 0.55, blossom: 0.15, sprig: 0.1, bud: 0.2 },
    ampPx: [25, 40],
    periodS: [5, 8],
    petalFillAlpha: [0.12, 0.2],
    blossomSpeed: 0.8,
    sprig: { branchPx: 1.6, flowerScale: 0.4 },
  },
  /**
   * Autumn (docs/tasks/seasons-art.md task 3): share of each leaf species, a wider and slower
   * sideways wobble (px at 1080p, s), and how far each control point of a leaf moves (± share).
   */
  leaves: {
    shares: { maple: 0.35, oak: 0.25, birch: 0.25, ginkgo: 0.15 },
    ampPx: [20, 40],
    periodS: [5, 9],
    jitter: 0.08,
  },
  /**
   * Winter (docs/tasks/seasons-art.md task 4): share of each element, speed × the band's, soft
   * dot radius (px at 1080p), branch length jitter of a dendritic flake (± share), the fir twig's
   * extra slowness and wider wobble, and the gusts: every `everyS` one band gets a common sideways
   * push of ± `pxPerS` lasting `durationS` (ease in-out).
   */
  winter: {
    shares: { dendrite: 0.45, plate: 0.2, dot: 0.3, fir: 0.05 },
    speed: 0.9,
    dotRadiusPx: [1.5, 3.5],
    branchJitter: 0.2,
    fir: { speed: 0.7, ampPx: [25, 40] },
    gust: { everyS: [6, 12], pxPerS: 20, durationS: 2 },
  },
  /** Canvas (and sprite) pixel density cap. */
  maxDpr: 1.5,
  /**
   * Depth bands (docs/tasks/seasons-art.md task 1), far to near: share of new particles, size,
   * speed and opacity multipliers (opacity × `--season-alpha`), sprite outline width (px).
   */
  bands: [
    { share: 0.45, size: 0.55, speed: 0.6, alpha: 0.55, linePx: 1.2 },
    { share: 0.35, size: 1, speed: 1, alpha: 0.8, linePx: 1.4 },
    { share: 0.2, size: 1.6, speed: 1.5, alpha: 1, linePx: 1.6 },
  ],
  /** Sideways wobble `x0 + A · sin(2πt / T + φ)`: amplitude A (px at 1080p) and period T (s) ranges. */
  wobbleAmpPx: [12, 40],
  wobblePeriodS: [4, 9],
  /** Fixed tilt of each particle, uniform in ± this many degrees; it never turns. */
  tiltDeg: 35,
  /** Each particle is ± this share bigger or smaller than its band's size. */
  sizeJitter: 0.12,
  /** Sizes and wobble scale with `innerHeight / viewHeight`, clamped to `viewScale`. */
  viewHeight: 1080,
  viewScale: [0.75, 1.25],
  /** Sprite variants per element type: common types and rare ones. */
  variants: { common: 6, rare: 3 },
  /** Seed of the sprite shapes: the same variants on every start. */
  spriteSeed: 1789,
  /** Sprite strokes: fill and veins of the outline colour, a second offset "pencil" outline. */
  sprite: { fillAlpha: 0.16, veinWidth: 0.8, veinAlpha: 0.7, pencilPx: [0.6, 0.8], pencilAlpha: 0.45 },
  /** Particles fade out over this many px on each side of the line's band. */
  bandFeatherPx: 24,
  /** A drag faster than this (screen px/ms) counts as fast scrolling; so does a jump longer than the window. */
  fastDragPxPerMs: 1.2,
} as const;
