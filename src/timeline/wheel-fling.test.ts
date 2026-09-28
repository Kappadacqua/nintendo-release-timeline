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

describe("WheelFling gears", () => {
  it("gear 1: one unit per isolated notch, no inertia", () => {
    const actions = feed(new WheelFling(), [0, 500, 1000]).map(move);
    for (const a of actions) expect(a).toMatchObject({ gear: 1, start: true, units: 1, moved: 1, rest: 1 });
  });

  it("gear 1: a short quick spin moves one unit per notch (3 notches = 3, 4 notches = 4)", () => {
    expect(move(feed(new WheelFling(), spin(3, 30)).at(-1)!)).toMatchObject({ gear: 1, moved: 3, rest: 3 });
    expect(move(feed(new WheelFling(), spin(4, 30)).at(-1)!)).toMatchObject({ gear: 1, moved: 4, rest: 4 });
  });

  it("gear 2: after 300 ms of spin, 3 units per notch and 7 of inertia", () => {
    const a = feed(new WheelFling(), spin(12, 30)).map(move); // last notch at 330 ms
    expect(a[9]).toMatchObject({ gear: 1, moved: 10 }); // 270 ms
    expect(a[10]).toMatchObject({ gear: 2, units: 3, moved: 13, rest: 20 }); // 300 ms
    expect(a[11]).toMatchObject({ gear: 2, units: 3, moved: 16, rest: 23 });
  });

  it("gear 3: after 800 ms of spin, 7 units per notch and up to 30 of inertia", () => {
    const fling = new WheelFling();
    const a = feed(fling, spin(10, 100)).map(move); // 0…900 ms, every notch ≤ 100 ms apart
    expect(a[3].gear).toBe(2); // 300 ms
    expect(a[8]).toMatchObject({ gear: 3, units: 7 }); // 800 ms
    const last = a[9];
    expect(last.gear).toBe(3);
    expect(last.rest).toBe(Math.min(TIMELINE.wheelFlingMaxDays, last.moved + 30));
  });

  it("shifts up 1 → 2 → 3 as the spin goes on", () => {
    const gears = feed(new WheelFling(), spin(30, 40)).map((a) => move(a).gear);
    expect(gears.indexOf(2)).toBe(8); // 320 ms
    expect(gears.indexOf(3)).toBe(20); // 800 ms
    expect([...gears].sort()).toEqual(gears); // never down while the pace holds
  });

  it("drops a gear when the pace slows, back to gear 1 after a pause", () => {
    const fling = new WheelFling();
    feed(fling, spin(22, 40)); // gear 3 at 840 ms
    expect(move(fling.notch(840 + 120, 1, 1, idle)).gear).toBe(2); // slower notch
    expect(move(fling.notch(960 + 120, 1, 1, idle)).gear).toBe(1);
    const afterPause = move(fling.notch(1080 + 400, 1, 1, idle));
    expect(afterPause).toMatchObject({ gear: 1, start: true, moved: 1 });
  });

  it("the landing never moves back within a spin, even when the gear drops", () => {
    const fling = new WheelFling();
    const rests = [...feed(fling, spin(12, 30)), fling.notch(450, 1, 1, idle)].map((a) => move(a).rest);
    for (let i = 1; i < rests.length; i++) expect(rests[i]).toBeGreaterThanOrEqual(rests[i - 1]);
  });

  it("never goes further than the limit, notches and inertia together", () => {
    for (const every of [10, 30, 60, 90]) {
      const a = feed(new WheelFling(), spin(200, every)).map(move);
      const total = a.reduce((sum, x) => sum + x.units, 0);
      expect(total).toBeLessThanOrEqual(TIMELINE.wheelFlingMaxDays);
      for (const x of a) expect(x.rest).toBeLessThanOrEqual(TIMELINE.wheelFlingMaxDays);
    }
    // 25 quick notches: well within the limit (was 145 days).
    const quick = move(feed(new WheelFling(), spin(25, 30)).at(-1)!);
    expect(quick.rest).toBeLessThanOrEqual(TIMELINE.wheelFlingMaxDays);
  });

  it("the limit is per spin, in the zoom's units", () => {
    const weeks = { ...idle, maxUnits: 13 };
    const a = feed(new WheelFling(), spin(100, 30), 1, weeks).map(move);
    expect(a.at(-1)).toMatchObject({ moved: 13, rest: 13, units: 0 });
  });

  it("counts notches merged into one event", () => {
    const fling = new WheelFling();
    feed(fling, spin(11, 30)); // gear 2 at 300 ms
    expect(move(fling.notch(330, 1, 2, idle)).units).toBe(6);
  });

  it("goes backward with negative distances", () => {
    const a = move(feed(new WheelFling(), spin(12, 30), -1).at(-1)!);
    expect(a).toMatchObject({ gear: 2, units: -3, moved: -16, rest: -23 });
  });

  it("a notch the other way starts a new spin", () => {
    const fling = new WheelFling();
    feed(fling, spin(12, 30));
    expect(move(fling.notch(360, -1, 1, idle))).toMatchObject({ gear: 1, start: true, moved: -1 });
  });

  it("brakes on a notch against the fling in progress", () => {
    const fling = new WheelFling();
    feed(fling, spin(12, 30));
    expect(fling.notch(360, -1, 1, { ...idle, flying: 1 })).toEqual({ kind: "brake" });
    // The next notch starts afresh: a single step back.
    expect(move(fling.notch(390, -1, 1, idle))).toMatchObject({ gear: 1, start: true, units: -1 });
  });

  it("reset (click, key, drag) starts a new spin", () => {
    const fling = new WheelFling();
    feed(fling, spin(12, 30));
    fling.reset();
    expect(move(fling.notch(360, 1, 1, idle))).toMatchObject({ gear: 1, start: true, moved: 1 });
  });

  it("stays in gear 1 right after trackpad-like input", () => {
    const fling = new WheelFling();
    fling.trackpad(0);
    expect(feed(fling, spin(12, 30, 10)).map((a) => move(a).gear)).toEqual(Array(12).fill(1));
    expect(move(feed(fling, spin(12, 30, 1000)).at(-1)!).gear).toBe(2);
  });

  it("with reduced motion, gears shift but there is no inertia", () => {
    const a = move(feed(new WheelFling(), spin(12, 30), 1, { ...idle, reduced: true }).at(-1)!);
    expect(a).toMatchObject({ gear: 2, moved: 16, rest: 16 });
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
