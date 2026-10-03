import { TIMELINE } from "./config";

/** Mouse-wheel spins (no DOM): what each notch does, and when a spin ends. */

export type WheelFlingConfig = Pick<typeof TIMELINE, "wheelSpinGapMs" | "wheelSpinPx" | "wheelTrackpadHoldMs">;

/**
 * What a wheel notch does.
 * - `step`: an isolated notch, exactly `units` (signed) days, weeks or months, snapped as usual.
 * - `spin`: a notch of a continuous spin, `px` (signed) added to the destination, never snapped.
 * - `brake`: a notch against a spin still moving the view: stop it.
 */
export type WheelAction =
  | { kind: "step"; units: number }
  | { kind: "spin"; px: number }
  | { kind: "brake" };

/**
 * Tracks wheel notches as spins (notches less than `wheelSpinGapMs` apart). The first notch of a
 * spin is a plain step of one unit; every further notch adds a fixed `wheelSpinPx` to the
 * destination at any zoom level, so the view scrolls freely, as fast as the wheel turns. Once no
 * notch has come for `wheelSpinGapMs`, the spin is over and the view settles on the nearest unit
 * or release (`settle`, `restPoint`). Trackpads always step.
 */
export class WheelFling {
  private last = -Infinity;
  private dir = 0;
  /** The current spin has moved freely (it needs a magnet when it ends). */
  private spinning = false;
  private trackpadAt = -Infinity;

  constructor(private cfg: WheelFlingConfig = TIMELINE) {}

  /** A trackpad-like event (small delta): plain steps for a while, it is not a mouse wheel (a spin in progress still settles). */
  trackpad(time: number) {
    this.trackpadAt = time;
    this.last = -Infinity;
  }

  /** Forget the spin (a click, a key, a drag): the next notch starts a new one, nothing to settle. */
  reset() {
    this.last = -Infinity;
    this.spinning = false;
  }

  /**
   * `count` notches (usually 1) in direction `dir` at `time`.
   * `moving`: direction the view is still moving in because of a spin, 0 if none.
   */
  notch(time: number, dir: 1 | -1, count: number, state: { moving: number }): WheelAction {
    if (state.moving && dir !== state.moving) {
      this.reset();
      this.dir = dir;
      return { kind: "brake" };
    }
    const start =
      dir !== this.dir || time - this.last >= this.cfg.wheelSpinGapMs || time - this.trackpadAt < this.cfg.wheelTrackpadHoldMs;
    this.last = time;
    this.dir = dir;
    if (start) {
      this.spinning = false;
      return { kind: "step", units: dir * count };
    }
    this.spinning = true;
    return { kind: "spin", px: dir * count * this.cfg.wheelSpinPx };
  }

  /** At `time`, has a spin that moved freely just ended? (true once: the magnet then takes over.) */
  settle(time: number) {
    if (!this.spinning || time - this.last < this.cfg.wheelSpinGapMs) return false;
    this.spinning = false;
    return true;
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
