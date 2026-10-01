import { TIMELINE } from "./config";

/** Mouse-wheel ramp (no DOM): how far each notch of a spin moves, and where the spin lands. */

export type WheelFlingConfig = Pick<
  typeof TIMELINE,
  | "wheelGearGapMs"
  | "wheelGearSlowGapMs"
  | "wheelSlowLoss"
  | "wheelRampDelayMs"
  | "wheelRampMs"
  | "wheelMaxPace"
  | "wheelInertiaPerPace"
  | "wheelGearPace"
  | "wheelTrackpadHoldMs"
>;

/**
 * What a wheel notch does. Distances are signed, in units (days, weeks or months) from where
 * the spin started (`start`: this notch starts a new one): `moved` covered by the notches so far,
 * `rest` where the view comes to rest after the inertia (never behind `moved`, never shorter
 * than for an earlier notch of the same spin). `units`: this notch's own share of `moved`.
 * `pace`: units per notch at this point of the spin (1 … `wheelMaxPace`, fractional); `gear`
 * is the same pace in three steps (`wheelGearPace`).
 */
export type WheelAction =
  | { kind: "move"; gear: 1 | 2 | 3; pace: number; start: boolean; units: number; moved: number; rest: number }
  | { kind: "brake" };

/**
 * Tracks wheel notches as spins (notches less than `wheelGearGapMs` apart). The longer the
 * spin, the faster it goes, on a steady ramp: more units per notch and more inertia after it.
 * A slower notch gives back part of the ramp, a pause starts a new spin at one unit per notch.
 * A spin (notches + inertia) never goes further than `maxUnits`. A notch against a fling in
 * progress brakes it. Trackpads stay at one unit per notch.
 */
export class WheelFling {
  private last = -Infinity;
  private dir = 0;
  /** Continuous spin time (ms) the pace is read from. */
  private spin = 0;
  /** Units covered, with the fractions of the pace (`moved` is its whole part). */
  private exact = 0;
  private moved = 0;
  private rest = 0;
  private trackpadAt = -Infinity;

  constructor(private cfg: WheelFlingConfig = TIMELINE) {}

  /** A trackpad-like event (small delta): one unit per notch for a while, it is not a mouse wheel. */
  trackpad(time: number) {
    this.trackpadAt = time;
    this.reset();
  }

  /** Forget the spin (a click, a key, a drag): the next notch starts a new one. */
  reset() {
    this.last = -Infinity;
  }

  /** Units per notch after a continuous spin of `spin` ms. */
  paceFor(spin: number) {
    const ramp = Math.min(1, Math.max(0, (spin - this.cfg.wheelRampDelayMs) / this.cfg.wheelRampMs));
    return 1 + (this.cfg.wheelMaxPace - 1) * ramp;
  }

  /** Gear (1–3) of a pace. */
  gearFor(pace: number): 1 | 2 | 3 {
    const [second, third] = this.cfg.wheelGearPace;
    return pace >= third ? 3 : pace >= second ? 2 : 1;
  }

  /**
   * `count` notches (usually 1) in direction `dir` at `time`.
   * `flying`: direction of the wheel fling in progress, 0 if none. `reduced`: no inertia at all.
   * `maxUnits`: longest spin, notches and inertia together.
   */
  notch(
    time: number,
    dir: 1 | -1,
    count: number,
    state: { flying: number; reduced: boolean; maxUnits: number },
  ): WheelAction {
    if (state.flying && dir !== state.flying) {
      this.reset();
      this.dir = dir;
      return { kind: "brake" };
    }
    const gap = time - this.last;
    const start = dir !== this.dir || gap >= this.cfg.wheelGearGapMs;
    if (start) {
      this.spin = 0;
      this.exact = 0;
      this.moved = 0;
      this.rest = 0;
    } else if (gap > this.cfg.wheelGearSlowGapMs) {
      // Slowing down: part of the ramp is lost, more the slower the notch.
      this.spin = Math.max(0, this.spin - (gap - this.cfg.wheelGearSlowGapMs) * this.cfg.wheelSlowLoss);
    } else {
      this.spin += gap;
    }
    if (time - this.trackpadAt < this.cfg.wheelTrackpadHoldMs) this.spin = 0;
    this.last = time;
    this.dir = dir;

    const pace = this.paceFor(this.spin);
    const before = this.moved;
    this.exact = Math.min(state.maxUnits, this.exact + count * pace);
    // Every notch moves at least one unit (a fraction left over carries on to the next).
    this.moved = Math.min(state.maxUnits, Math.max(before + count, Math.floor(this.exact + 1e-9)));
    this.exact = Math.max(this.exact, this.moved);
    const inertia = state.reduced ? 0 : Math.round((pace - 1) * this.cfg.wheelInertiaPerPace);
    this.rest = Math.max(this.rest, Math.min(state.maxUnits, this.moved + inertia));
    return {
      kind: "move",
      gear: this.gearFor(pace),
      pace,
      start,
      units: dir * (this.moved - before),
      moved: dir * this.moved,
      rest: dir * this.rest,
    };
  }
}

/**
 * Where a spin heading for `stop` comes to rest, never outside `lo`…`hi`: on the nearest
 * release within `magnetPx` of it, otherwise on the nearest snap point.
 */
export function restPoint(
  stop: number,
  opts: {
    lo: number;
    hi: number;
    snap: (x: number) => number;
    /** World x of the releases shown (active filters). */
    magnets: readonly number[];
    magnetPx: number;
  },
) {
  const clamp = (x: number) => Math.min(opts.hi, Math.max(opts.lo, x));
  let best: number | null = null;
  for (const x of opts.magnets) {
    if (x < opts.lo || x > opts.hi) continue;
    const d = Math.abs(x - stop);
    if (d <= opts.magnetPx && (best === null || d < Math.abs(best - stop))) best = x;
  }
  return best ?? clamp(opts.snap(clamp(stop)));
}
