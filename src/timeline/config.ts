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

  /** Wheel momentum: this many notches within `wheelFlingWindowMs` start a fling… */
  wheelFlingNotches: 3,
  wheelFlingWindowMs: 150,
  /** …at `wheelFlingGain` units (days, weeks, months) per second for each notch per second… */
  wheelFlingGain: 1.5,
  /** …plus this fraction more for each notch per second above the threshold rate (faster spin, longer fling). */
  wheelFlingAccel: 0.05,
  /** Speed kept per 60fps frame while a wheel fling slows down (same as a drag's `flingFriction`). */
  wheelFlingFriction: 0.94,
  /** A wheel fling never coasts further than this many days (about 3 months, at any zoom). */
  wheelFlingMaxDays: 91,
  /** A wheel fling that would stop within this many units of a release lands on it. */
  wheelMagnetUnits: 2,
  /** After a trackpad-like event (small delta), wheel events never fling for this long. */
  wheelTrackpadHoldMs: 400,
  /** Reduced motion: each notch of a quick burst moves this many days (1 unit at Week / Month). */
  wheelReducedRapidDays: 7,

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
