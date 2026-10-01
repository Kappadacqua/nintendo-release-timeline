import { describe, expect, it } from "vitest";
import { TIMELINE } from "./config";
import { restPoint, WheelFling, type WheelAction } from "./wheel-fling";

const idle = { flying: 0, reduced: false, maxUnits: TIMELINE.wheelFlingMaxDays };

/** Notch times from `from`, `every` ms apart. */
const spin = (count: number, every: number, from = 0) => Array.from({ length: count }, (_, i) => from + i * every);

/** Feeds notches at `times` in direction `dir` and returns every action. */
function feed(fling: WheelFling, times: number[], dir: 1 | -1 = 1, state = idle) {
  return times.map((t) => fling.notch(t, dir, 1, state));
}

const move = (action: WheelAction) => {
  if (action.kind !== "move") throw new Error(`expected a move, got ${action.kind}`);
  return action;
};

describe("WheelFling ramp", () => {
  const { wheelRampDelayMs: delay, wheelRampMs: ramp, wheelMaxPace: top, wheelInertiaPerPace: perPace } = TIMELINE;
  const [second, third] = TIMELINE.wheelGearPace;
  /** No limit in the way. */
  const open = { ...idle, maxUnits: 10_000 };

  it("pace 1: one unit per isolated notch, no inertia", () => {
    const actions = feed(new WheelFling(), [0, 500, 1000]).map(move);
    for (const a of actions) expect(a).toMatchObject({ gear: 1, pace: 1, start: true, units: 1, moved: 1, rest: 1 });
  });

  it("a short quick spin moves one unit per notch (3 notches = 3, 4 notches = 4)", () => {
    expect(move(feed(new WheelFling(), spin(3, 30)).at(-1)!)).toMatchObject({ gear: 1, moved: 3, rest: 3 });
    expect(move(feed(new WheelFling(), spin(4, 30)).at(-1)!)).toMatchObject({ gear: 1, moved: 4, rest: 4 });
  });

  it("the pace rises steadily from 1 to the top, with no jumps", () => {
    const fling = new WheelFling();
    const times = spin(60, 30);
    const paces = feed(fling, times).map((a) => move(a).pace);
    times.forEach((t, i) => {
      const expected = 1 + ((top - 1) * Math.min(1, Math.max(0, (t - delay) / ramp)));
      expect(paces[i]).toBeCloseTo(expected);
    });
    const step = ((top - 1) * 30) / ramp;
    for (let i = 1; i < paces.length; i++) {
      expect(paces[i]).toBeGreaterThanOrEqual(paces[i - 1]);
      expect(paces[i] - paces[i - 1]).toBeLessThanOrEqual(step + 1e-9);
    }
    expect(paces.at(-1)).toBe(top);
  });

  it("each notch moves its pace (whole units, the fractions carry on)", () => {
    const a = feed(new WheelFling(), spin(40, 30), 1, open).map(move);
    let exact = 0;
    for (const x of a) {
      exact += x.pace;
      expect(x.units).toBeGreaterThanOrEqual(1);
      expect(Math.abs(x.moved - exact)).toBeLessThan(1);
    }
  });

  it("inertia grows with the pace", () => {
    const a = feed(new WheelFling(), spin(40, 30), 1, open).map(move);
    for (const x of a) expect(x.rest).toBe(x.moved + Math.round((x.pace - 1) * perPace));
  });

  it("gears are steps of the pace", () => {
    const a = feed(new WheelFling(), spin(60, 30)).map(move);
    for (const x of a) expect(x.gear).toBe(x.pace >= third ? 3 : x.pace >= second ? 2 : 1);
    expect(a.some((x) => x.gear === 2)).toBe(true);
    expect(a.at(-1)!.gear).toBe(3);
  });

  it("a slower notch gives back part of the ramp, a pause starts afresh", () => {
    const fling = new WheelFling();
    const fast = move(feed(fling, spin(30, 40)).at(-1)!); // 1160 ms of spin
    const slower = move(fling.notch(1160 + 120, 1, 1, idle));
    expect(slower.start).toBe(false);
    expect(slower.pace).toBeLessThan(fast.pace);
    expect(slower.pace).toBeGreaterThan(1);
    const afterPause = move(fling.notch(1280 + 400, 1, 1, idle));
    expect(afterPause).toMatchObject({ gear: 1, pace: 1, start: true, moved: 1 });
  });

  it("the landing never moves back within a spin, even when the pace drops", () => {
    const fling = new WheelFling();
    const rests = [...feed(fling, spin(30, 30)), fling.notch(990, 1, 1, idle)].map((a) => move(a).rest);
    for (let i = 1; i < rests.length; i++) expect(rests[i]).toBeGreaterThanOrEqual(rests[i - 1]);
  });

  it("never goes further than the limit, notches and inertia together", () => {
    for (const every of [10, 30, 60, 90]) {
      const a = feed(new WheelFling(), spin(200, every)).map(move);
      const total = a.reduce((sum, x) => sum + x.units, 0);
      expect(total).toBeLessThanOrEqual(TIMELINE.wheelFlingMaxDays);
      for (const x of a) expect(x.rest).toBeLessThanOrEqual(TIMELINE.wheelFlingMaxDays);
    }
  });

  it("the limit is per spin, in the zoom's units", () => {
    const weeks = { ...idle, maxUnits: 13 };
    const a = feed(new WheelFling(), spin(100, 30), 1, weeks).map(move);
    expect(a.at(-1)).toMatchObject({ moved: 13, rest: 13, units: 0 });
  });

  it("counts notches merged into one event", () => {
    const fling = new WheelFling();
    feed(fling, spin(3, 30));
    expect(move(fling.notch(90, 1, 2, idle)).units).toBe(2);
    const late = new WheelFling();
    feed(late, spin(42, 30), 1, open); // 1230 ms: the top pace
    expect(move(late.notch(1260, 1, 2, open)).units).toBe(2 * top);
  });

  it("goes backward with negative distances", () => {
    const forward = move(feed(new WheelFling(), spin(20, 30)).at(-1)!);
    const backward = move(feed(new WheelFling(), spin(20, 30), -1).at(-1)!);
    expect(backward).toMatchObject({ units: -forward.units, moved: -forward.moved, rest: -forward.rest, pace: forward.pace });
  });

  it("a notch the other way starts a new spin", () => {
    const fling = new WheelFling();
    feed(fling, spin(20, 30));
    expect(move(fling.notch(600, -1, 1, idle))).toMatchObject({ gear: 1, pace: 1, start: true, moved: -1 });
  });

  it("brakes on a notch against the fling in progress", () => {
    const fling = new WheelFling();
    feed(fling, spin(20, 30));
    expect(fling.notch(600, -1, 1, { ...idle, flying: 1 })).toEqual({ kind: "brake" });
    // The next notch starts afresh: a single step back.
    expect(move(fling.notch(630, -1, 1, idle))).toMatchObject({ gear: 1, start: true, units: -1 });
  });

  it("reset (click, key, drag) starts a new spin", () => {
    const fling = new WheelFling();
    feed(fling, spin(20, 30));
    fling.reset();
    expect(move(fling.notch(600, 1, 1, idle))).toMatchObject({ pace: 1, start: true, moved: 1 });
  });

  it("stays at pace 1 right after trackpad-like input", () => {
    const fling = new WheelFling();
    fling.trackpad(0);
    expect(feed(fling, spin(12, 30, 10)).map((a) => move(a).pace)).toEqual(Array(12).fill(1));
    expect(move(feed(fling, spin(20, 30, 1000)).at(-1)!).pace).toBeGreaterThan(1);
  });

  it("with reduced motion, the pace rises but there is no inertia", () => {
    const a = move(feed(new WheelFling(), spin(20, 30), 1, { ...idle, reduced: true }).at(-1)!);
    expect(a.pace).toBeGreaterThan(1);
    expect(a.rest).toBe(a.moved);
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

  it("ignores releases outside the range (never past the limit)", () => {
    expect(restPoint(90 * dayPx, { ...base, magnets: [92 * dayPx] })).toBe(90 * dayPx);
  });
});
