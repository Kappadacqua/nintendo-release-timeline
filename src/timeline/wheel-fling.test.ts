import { describe, expect, it } from "vitest";
import { TIMELINE } from "./config";
import { coastDistance, flingVelocity, restPoint, WheelFling } from "./wheel-fling";

const idle = { flying: 0, reduced: false };

/** Feeds notches at `times` in direction `dir` and returns the last action. */
function burst(fling: WheelFling, times: number[], dir: 1 | -1 = 1, state = idle) {
  return times.map((t) => fling.notch(t, dir, 1, state)).at(-1)!;
}

describe("flingVelocity", () => {
  it("is 0 below the notch threshold", () => {
    expect(flingVelocity([0, 40])).toBe(0);
  });

  it("grows with the notch rate, faster than linearly", () => {
    const slow = flingVelocity([0, 70, 140]); // ~14 notches/s
    const fast = flingVelocity([0, 25, 50]); // 40 notches/s
    expect(slow).toBeGreaterThan(0);
    expect(fast).toBeGreaterThan(slow * (40 / 14.3));
  });

  it("counts notches merged into one event", () => {
    expect(flingVelocity([100, 100, 100])).toBeGreaterThan(0);
  });
});

describe("WheelFling", () => {
  it("steps one unit per isolated notch", () => {
    const fling = new WheelFling();
    expect(fling.notch(0, 1, 1, idle)).toEqual({ kind: "step", units: 1, rapid: false });
    expect(fling.notch(500, 1, 1, idle)).toEqual({ kind: "step", units: 1, rapid: false });
    expect(fling.notch(560, 1, 1, idle)).toEqual({ kind: "step", units: 1, rapid: false });
  });

  it("flings once enough notches fall in the window", () => {
    const fling = new WheelFling();
    expect(burst(fling, [0, 50])).toMatchObject({ kind: "step" });
    const action = fling.notch(100, 1, 1, idle);
    expect(action.kind).toBe("fling");
    if (action.kind === "fling") expect(action.velocity).toBeGreaterThan(0);
  });

  it("flings backward with a negative velocity", () => {
    const action = burst(new WheelFling(), [0, 40, 80], -1);
    expect(action.kind === "fling" && action.velocity < 0).toBe(true);
  });

  it("does not mix directions in a burst", () => {
    const fling = new WheelFling();
    burst(fling, [0, 30], 1);
    expect(fling.notch(60, -1, 1, idle)).toMatchObject({ kind: "step", units: -1 });
  });

  it("brakes on a notch against the fling in progress", () => {
    const fling = new WheelFling();
    burst(fling, [0, 30, 60]);
    expect(fling.notch(90, -1, 1, { flying: 1, reduced: false })).toEqual({ kind: "brake" });
    // The next notch starts afresh: a single step back.
    expect(fling.notch(400, -1, 1, idle)).toMatchObject({ kind: "step", units: -1 });
  });

  it("never flings right after trackpad-like input", () => {
    const fling = new WheelFling();
    fling.trackpad(0);
    expect(burst(fling, [10, 20, 30])).toMatchObject({ kind: "step", rapid: false });
    expect(burst(fling, [1000, 1030, 1060])).toMatchObject({ kind: "fling" });
  });

  it("with reduced motion, a quick burst steps (rapid) instead of flinging", () => {
    const reduced = { flying: 0, reduced: true };
    expect(burst(new WheelFling(), [0, 30, 60], 1, reduced)).toEqual({ kind: "step", units: 1, rapid: true });
  });
});

describe("coastDistance", () => {
  it("matches the frame-by-frame friction of a drag's inertia", () => {
    const v = 2; // px/ms
    let x = 0;
    let speed = v;
    for (let i = 0; i < 50_000; i++) {
      x += speed * 0.1;
      speed *= Math.pow(TIMELINE.wheelFlingFriction, 0.1 / (1000 / 60));
    }
    expect(coastDistance(v, TIMELINE.wheelFlingFriction)).toBeCloseTo(x, 0);
    expect(coastDistance(-v, TIMELINE.wheelFlingFriction)).toBeCloseTo(-x, 0);
  });
});

describe("restPoint", () => {
  const dayPx = 32;
  const base = {
    friction: TIMELINE.wheelFlingFriction,
    maxPx: 91 * dayPx,
    min: 0,
    max: 1000 * dayPx,
    snap: (x: number) => Math.round(x / dayPx) * dayPx,
    magnets: [] as number[],
    magnetPx: 2 * dayPx,
  };
  /** Speed (px/ms) that coasts exactly `days` days. */
  const speedFor = (days: number) => (days * dayPx) / coastDistance(1, base.friction);

  it("rests on the nearest day", () => {
    expect(restPoint(0, speedFor(10.3), base)).toBe(10 * dayPx);
  });

  it("never coasts further than the limit", () => {
    expect(restPoint(0, speedFor(500), base)).toBe(91 * dayPx);
    expect(restPoint(200 * dayPx, -speedFor(500), base)).toBe(109 * dayPx);
  });

  it("stays within the bounds", () => {
    expect(restPoint(995 * dayPx, speedFor(30), base)).toBe(1000 * dayPx);
  });

  it("lands on a release within the magnet radius", () => {
    expect(restPoint(0, speedFor(10.3), { ...base, magnets: [12 * dayPx] })).toBe(12 * dayPx);
    expect(restPoint(0, speedFor(10.3), { ...base, magnets: [8.5 * dayPx] })).toBe(8.5 * dayPx);
  });

  it("picks the nearest release", () => {
    expect(restPoint(0, speedFor(10), { ...base, magnets: [8.5 * dayPx, 11 * dayPx] })).toBe(11 * dayPx);
  });

  it("ignores releases beyond the radius", () => {
    expect(restPoint(0, speedFor(10), { ...base, magnets: [13 * dayPx, 7 * dayPx] })).toBe(10 * dayPx);
  });
});
