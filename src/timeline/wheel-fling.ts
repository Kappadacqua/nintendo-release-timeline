import { TIMELINE } from "./config";

/** Mouse-wheel momentum (no DOM): which notches fling, how fast, and where the fling lands. */

export type WheelFlingConfig = Pick<
  typeof TIMELINE,
  "wheelFlingNotches" | "wheelFlingWindowMs" | "wheelFlingGain" | "wheelFlingAccel" | "wheelTrackpadHoldMs"
>;

/** What a wheel notch does. `velocity` is in units (days, weeks or months) per ms, signed. */
export type WheelAction =
  | { kind: "step"; units: number; rapid: boolean }
  | { kind: "fling"; velocity: number }
  | { kind: "brake" };

const FRAME_MS = 1000 / 60;

/**
 * Speed of a fling (units/ms, unsigned) from the times of the notches in the window, or 0
 * when they are too few. It grows with the notch rate, faster than linearly (`wheelFlingAccel`).
 */
export function flingVelocity(times: number[], cfg: WheelFlingConfig = TIMELINE) {
  if (times.length < cfg.wheelFlingNotches) return 0;
  // Notches the browser merged into one event share a timestamp: count them a frame apart at most.
  const span = Math.max(times[times.length - 1] - times[0], (times.length - 1) * (FRAME_MS / 2));
  const rate = ((times.length - 1) / span) * 1000; // notches per second
  const minRate = ((cfg.wheelFlingNotches - 1) / cfg.wheelFlingWindowMs) * 1000;
  const perSecond = rate * cfg.wheelFlingGain * (1 + cfg.wheelFlingAccel * Math.max(0, rate - minRate));
  return perSecond / 1000;
}

/**
 * Tracks wheel notches and turns each into an action: isolated notches step, a quick burst
 * flings, a notch against a fling in progress brakes it. Trackpads never fling.
 */
export class WheelFling {
  private times: number[] = [];
  private dir = 0;
  private trackpadAt = -Infinity;

  constructor(private cfg: WheelFlingConfig = TIMELINE) {}

  /** A trackpad-like event (small delta): no fling for a while, it is not a mouse wheel. */
  trackpad(time: number) {
    this.trackpadAt = time;
    this.times = [];
  }

  /** Forget the burst (a click, a key, a drag). */
  reset() {
    this.times = [];
  }

  /**
   * `count` notches (usually 1) in direction `dir` at `time`.
   * `flying`: direction of the wheel fling in progress, 0 if none. `reduced`: no fling at all.
   */
  notch(time: number, dir: 1 | -1, count: number, state: { flying: number; reduced: boolean }): WheelAction {
    if (state.flying && dir !== state.flying) {
      this.times = [];
      this.dir = dir;
      return { kind: "brake" };
    }
    if (dir !== this.dir) this.times = [];
    this.dir = dir;
    for (let i = 0; i < count; i++) this.times.push(time);
    this.times = this.times.filter((t) => time - t <= this.cfg.wheelFlingWindowMs);
    const units = dir * count;
    if (time - this.trackpadAt < this.cfg.wheelTrackpadHoldMs) return { kind: "step", units, rapid: false };
    const speed = flingVelocity(this.times, this.cfg);
    if (!speed) return { kind: "step", units, rapid: false };
    if (state.reduced) return { kind: "step", units, rapid: true };
    return { kind: "fling", velocity: dir * speed };
  }
}

/** Distance covered by `velocity` (px/ms) slowing down by `friction` per 60fps frame, until it stops. */
export function coastDistance(velocity: number, friction: number) {
  return (velocity * FRAME_MS) / -Math.log(friction);
}

/**
 * Where a fling from `from` at `velocity` (px/ms) comes to rest: at most `maxPx` away, then on
 * the nearest release within `magnetPx` of that point, otherwise on the nearest snap point.
 */
export function restPoint(
  from: number,
  velocity: number,
  opts: {
    friction: number;
    maxPx: number;
    min: number;
    max: number;
    snap: (x: number) => number;
    /** World x of the releases shown (active filters). */
    magnets: readonly number[];
    magnetPx: number;
  },
) {
  const distance = coastDistance(velocity, opts.friction);
  const stop = Math.min(opts.max, Math.max(opts.min, from + Math.sign(distance) * Math.min(Math.abs(distance), opts.maxPx)));
  let best: number | null = null;
  for (const x of opts.magnets) {
    const d = Math.abs(x - stop);
    if (d <= opts.magnetPx && (best === null || d < Math.abs(best - stop))) best = x;
  }
  return best ?? opts.snap(stop);
}
