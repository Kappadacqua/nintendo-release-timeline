import { describe, expect, it } from "vitest";
import { TIMELINE } from "./config";
import { restPoint, WheelFling, type WheelAction } from "./wheel-fling";
import { ZOOM } from "./zoom";

const idle = { moving: 0 };
const { wheelSpinGapMs: gap, wheelSpinPx: spinPx } = TIMELINE;

/** Notch times from `from`, `every` ms apart. */
const spin = (count: number, every: number, from = 0) => Array.from({ length: count }, (_, i) => from + i * every);

/** Feeds notches at `times` in direction `dir` and returns every action. */
function feed(fling: WheelFling, times: number[], dir: 1 | -1 = 1, state = idle) {
  return times.map((t) => fling.notch(t, dir, 1, state));
}

/**
 * Destination (px from the start) after `actions`, at `unitPx` px per unit: what the scroller
 * does with them (a step from the snapped target, a spin notch added as it is).
 */
function destination(actions: WheelAction[], unitPx: number) {
  let x = 0;
  for (const a of actions) {
    if (a.kind === "step") x = Math.round(x / unitPx) * unitPx + a.units * unitPx;
    else if (a.kind === "spin") x += a.px;
  }
  return x;
}

describe("WheelFling", () => {
  it("an isolated notch moves exactly one unit", () => {
    expect(feed(new WheelFling(), [0])).toEqual([{ kind: "step", units: 1 }]);
    expect(feed(new WheelFling(), [0], -1)).toEqual([{ kind: "step", units: -1 }]);
  });

  it("slow notches, further apart than the gap, are steps of one unit each (3 → 3 units)", () => {
    const actions = feed(new WheelFling(), spin(3, gap + 50));
    expect(actions).toEqual(Array(3).fill({ kind: "step", units: 1 }));
    expect(destination(actions, 32)).toBe(3 * 32);
  });

  it("10 notches 50 ms apart: one unit, then 9 × wheelSpinPx, then the magnet settles on the nearest day", () => {
    const fling = new WheelFling();
    const dayPx = ZOOM.day.dayPx;
    const actions = feed(fling, spin(10, 50));
    expect(actions[0]).toEqual({ kind: "step", units: 1 });
    for (const a of actions.slice(1)) expect(a).toEqual({ kind: "spin", px: spinPx });
    const stop = destination(actions, dayPx);
    expect(stop).toBe(dayPx + 9 * spinPx);
    // Still spinning within the gap, over once the wheel has been quiet for it (once only).
    expect(fling.settle(450 + gap - 1)).toBe(false);
    expect(fling.settle(450 + gap)).toBe(true);
    expect(fling.settle(450 + gap + 100)).toBe(false);
    const snap = (x: number) => Math.round(x / dayPx) * dayPx;
    const rest = restPoint(stop, { lo: 0, hi: 1e6, snap, magnets: [], magnetPx: 2 * dayPx });
    expect(rest).toBe(snap(dayPx + 9 * spinPx));
    expect(rest % dayPx).toBe(0);
  });

  it("every spin notch moves the same px at Day, Week and Month, all through the spin", () => {
    for (const level of ["day", "week", "month"] as const) {
      const unitPx = ZOOM[level].dayPx * (level === "day" ? 1 : level === "week" ? 7 : 30.44);
      const actions = feed(new WheelFling(), spin(40, 30));
      const notches = actions.slice(1);
      for (const a of notches) expect(a).toEqual({ kind: "spin", px: spinPx });
      expect(destination(actions, unitPx)).toBeCloseTo(unitPx + 39 * spinPx);
    }
  });

  it("an isolated step needs no magnet", () => {
    const fling = new WheelFling();
    feed(fling, [0]);
    expect(fling.settle(10_000)).toBe(false);
  });

  it("counts notches merged into one event", () => {
    const fling = new WheelFling();
    expect(fling.notch(0, 1, 2, idle)).toEqual({ kind: "step", units: 2 });
    expect(fling.notch(30, 1, 3, idle)).toEqual({ kind: "spin", px: 3 * spinPx });
  });

  it("goes backward with negative distances", () => {
    const actions = feed(new WheelFling(), spin(5, 30), -1);
    expect(actions[0]).toEqual({ kind: "step", units: -1 });
    for (const a of actions.slice(1)) expect(a).toEqual({ kind: "spin", px: -spinPx });
  });

  it("a notch the other way starts a new spin (an isolated step)", () => {
    const fling = new WheelFling();
    feed(fling, spin(5, 30));
    expect(fling.notch(150, -1, 1, idle)).toEqual({ kind: "step", units: -1 });
  });

  it("brakes on a notch against a spin still moving the view, then starts afresh", () => {
    const fling = new WheelFling();
    feed(fling, spin(5, 30));
    expect(fling.notch(150, -1, 1, { moving: 1 })).toEqual({ kind: "brake" });
    expect(fling.settle(10_000)).toBe(false);
    expect(fling.notch(180, -1, 1, idle)).toEqual({ kind: "step", units: -1 });
  });

  it("reset (click, key, drag) starts a new spin, nothing left to settle", () => {
    const fling = new WheelFling();
    feed(fling, spin(5, 30));
    fling.reset();
    expect(fling.settle(10_000)).toBe(false);
    expect(fling.notch(160, 1, 1, idle)).toEqual({ kind: "step", units: 1 });
  });

  it("only steps right after trackpad-like input", () => {
    const fling = new WheelFling();
    fling.trackpad(0);
    expect(feed(fling, spin(12, 30, 10))).toEqual(Array(12).fill({ kind: "step", units: 1 }));
    const later = feed(fling, spin(3, 30, 1000));
    expect(later.slice(1)).toEqual(Array(2).fill({ kind: "spin", px: spinPx }));
  });
});

describe("restPoint", () => {
  const dayPx = 32;
  const base = {
    lo: 0,
    hi: 91 * dayPx,
    snap: (x: number) => Math.round(x / dayPx) * dayPx,
    magnets: [] as number[],
    magnetPx: 2 * dayPx,
  };

  it("rests on the nearest day", () => {
    expect(restPoint(10.3 * dayPx, base)).toBe(10 * dayPx);
  });

  it("stays within the range", () => {
    expect(restPoint(500 * dayPx, base)).toBe(91 * dayPx);
    expect(restPoint(-5 * dayPx, base)).toBe(0);
  });

  it("lands on a release within the magnet radius", () => {
    expect(restPoint(10.3 * dayPx, { ...base, magnets: [12 * dayPx] })).toBe(12 * dayPx);
    expect(restPoint(10.3 * dayPx, { ...base, magnets: [8.5 * dayPx] })).toBe(8.5 * dayPx);
  });

  it("picks the nearest release", () => {
    expect(restPoint(10 * dayPx, { ...base, magnets: [8.5 * dayPx, 11 * dayPx] })).toBe(11 * dayPx);
  });

  it("ignores releases beyond the radius", () => {
    expect(restPoint(10 * dayPx, { ...base, magnets: [13 * dayPx, 7 * dayPx] })).toBe(10 * dayPx);
  });

  it("lands on a release within 2 units of where the spin stops, at Week too", () => {
    const weekPx = 7 * ZOOM.week.dayPx;
    const week = { ...base, hi: 1e6, snap: (x: number) => Math.round(x / weekPx) * weekPx, magnetPx: TIMELINE.wheelMagnetUnits * weekPx };
    expect(restPoint(10.3 * weekPx, { ...week, magnets: [12 * weekPx - 3 * ZOOM.week.dayPx] })).toBe(12 * weekPx - 3 * ZOOM.week.dayPx);
    expect(restPoint(10.3 * weekPx, { ...week, magnets: [13 * weekPx] })).toBe(10 * weekPx);
  });

  it("ignores releases outside the range (never past the limit)", () => {
    expect(restPoint(90 * dayPx, { ...base, magnets: [92 * dayPx] })).toBe(90 * dayPx);
  });
});
