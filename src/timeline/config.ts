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
  /** Drag inertia (ITERATION-4 §10): speed kept per 60fps frame (lower = more friction). */
  flingFriction: 0.94,
  /** Below this release speed (px/ms) a drag just snaps: no inertia from a slow or tiny move. */
  flingMinVelocity: 0.35,
  /** Inertia ends (and snaps) once it slows below this speed (px/ms). */
  flingStopVelocity: 0.08,

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
  /** Cards never shrink below this scale on short windows. */
  minCardScale: 0.55,
};
