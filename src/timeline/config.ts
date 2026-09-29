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
  /** New particles of a season reach their full number over this long after they start. */
  rampMs: 2000,
  /** A new particle fades in over this long (it never pops up). */
  fadeInMs: 800,
  /** At a season change the old season's particles fade out over this long; the new one starts after. */
  leaveMs: 500,
  /** After fast scrolling the background comes back this long after the timeline stopped (fades: tokens.css). */
  restMs: 500,
  /** Particles at the smallest and largest window area. */
  minParticles: 20,
  maxParticles: 40,
  /** Window areas (px²) of those counts: 1280 × 720 and 2560 × 1440. */
  minArea: 1280 * 720,
  maxArea: 2560 * 1440,
  /** Canvas pixel density cap. */
  maxDpr: 1.5,
  /** A drag faster than this (screen px/ms) counts as fast scrolling; so does a jump longer than the window. */
  fastDragPxPerMs: 1.2,
} as const;
