export const TIMELINE = {
  /** Horizontal pixels per day (SPEC §6: ~24px). */
  dayPx: 24,
  /** Switch 2 launch: first day on the line. */
  startDate: "2025-06-05",
  /** Days of line drawn after the last precise release date (or today, if later). */
  endMarginDays: 60,
  /** Arrow keys move by this many days; Shift+arrow by `keyStepDaysLarge`. */
  keyStepDays: 7,
  keyStepDaysLarge: 30,
  /** Fraction of the remaining distance covered per 60fps frame (lower = more inertia). */
  smoothing: 0.16,
  /** How far a drag release keeps gliding, in ms of release velocity. */
  flingMs: 220,

  /** Distance from the line to the nearest card (connector length). */
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
  minCardScale: 0.6,
};
