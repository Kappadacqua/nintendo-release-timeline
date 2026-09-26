export const TIMELINE = {
  /** Horizontal pixels per day (ITERATION-2 §2: ~32px). */
  dayPx: 32,
  /** Switch 2 launch: first day on the line. */
  startDate: "2025-06-05",
  /** Days of line drawn after the last precise release date (or today, if later). */
  endMarginDays: 60,
  /** Shift+arrow moves by this many days (plain arrows: one day). */
  keyStepDaysLarge: 7,
  /** A wheel event at least this big (px) is one mouse-wheel notch = one day. */
  wheelNotchPx: 40,
  /** Pixels per notch when the browser merges several notches into one event. */
  wheelNotchUnitPx: 100,
  /** Trackpad: small deltas add up to this many px before moving one day. */
  trackpadDayPx: 40,
  /** Day numbers are printed under the ticks of these days of the month. */
  labeledDays: [1, 5, 10, 15, 20, 25],
  /** Fraction of the remaining distance covered per 60fps frame (lower = more inertia). */
  smoothing: 0.16,
  /** How far a drag release keeps gliding, in ms of release velocity. */
  flingMs: 220,

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
  /** Cards never shrink below this scale on short windows. */
  minCardScale: 0.55,
};
