import { TIMELINE } from "./config";

/** Mouse-wheel gears (no DOM): how far each notch of a spin moves, and where the spin lands. */

export type WheelFlingConfig = Pick<
  typeof TIMELINE,
  | "wheelGearGapMs"
  | "wheelGearSlowGapMs"
  | "wheelGearStartMs"
  | "wheelGearUnits"
  | "wheelGearInertiaUnits"
  | "wheelTrackpadHoldMs"
>;

/**
 * What a wheel notch does. Distances are signed, in units (days, weeks or months) from where
 * the spin started (`start`: this notch starts a new one): `moved` covered by the notches so far,
 * `rest` where the view comes to rest after the inertia (never behind `moved`, never shorter
 * than for an earlier notch of the same spin). `units`: this notch's own share of `moved`.
 */
export type WheelAction =
  | { kind: "move"; gear: 1 | 2 | 3; start: boolean; units: number; moved: number; rest: number }
  | { kind: "brake" };

/**
 * Tracks wheel notches as spins (notches less than `wheelGearGapMs` apart). The longer the
 * spin, the higher the gear: more units per notch and more inertia after it. A slower notch
 * drops a gear, a pause starts a new spin in gear 1. A spin (notches + inertia) never goes
 * further than `maxUnits`. A notch against a fling in progress brakes it. Trackpads stay in gear 1.
 */
export class WheelFling {
  private last = -Infinity;
  private dir = 0;
  /** Continuous spin time (ms) the gear is read from. */
  private spin = 0;
  private moved = 0;
  private rest = 0;
  private trackpadAt = -Infinity;

  constructor(private cfg: WheelFlingConfig = TIMELINE) {}

  /** A trackpad-like event (small delta): gear 1 for a while, it is not a mouse wheel. */
  trackpad(time: number) {
    this.trackpadAt = time;
    this.reset();
  }

  /** Forget the spin (a click, a key, a drag): the next notch starts a new one. */
  reset() {
    this.last = -Infinity;
  }

  /** Gear (1–3) for a continuous spin of `spin` ms. */
  gearFor(spin: number): 1 | 2 | 3 {
    const [second, third] = this.cfg.wheelGearStartMs;
    return spin >= third ? 3 : spin >= second ? 2 : 1;
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
      this.moved = 0;
      this.rest = 0;
    } else if (gap > this.cfg.wheelGearSlowGapMs) {
      // Slowing down: back to the start of the gear below.
      const gear = this.gearFor(this.spin);
      this.spin = gear === 3 ? this.cfg.wheelGearStartMs[0] : 0;
    } else {
      this.spin += gap;
    }
    if (time - this.trackpadAt < this.cfg.wheelTrackpadHoldMs) this.spin = 0;
    this.last = time;
    this.dir = dir;

    const gear = this.gearFor(this.spin);
    const before = this.moved;
    this.moved = Math.min(state.maxUnits, this.moved + count * this.cfg.wheelGearUnits[gear - 1]);
    const inertia = state.reduced ? 0 : this.cfg.wheelGearInertiaUnits[gear - 1];
    this.rest = Math.max(this.rest, Math.min(state.maxUnits, this.moved + inertia));
    return { kind: "move", gear, start, units: dir * (this.moved - before), moved: dir * this.moved, rest: dir * this.rest };
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
