import { describe, expect, it } from "vitest";
import { SEASONS } from "../timeline/config";
import { fadeIn, Gusts, isGone, kindRadius, SINKING, spawnParticle, stepParticle, viewScale, WheelPush, wobbleX } from "./particles";
import type { Season } from "./season";

const W = 1920;
const H = 1080;

/** Deterministic random numbers. */
function seeded(seed = 1) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

/** Steps a particle at 60 fps until it leaves the window; returns the seconds it took. */
function lifetime(season: Season, rand = seeded()) {
  const p = spawnParticle(season, W, H, 0, false, rand);
  let t = 0;
  while (!isGone(p, W, H) && t < 600) {
    t += 1 / 60;
    stepParticle(p, 1 / 60);
  }
  return { p, t };
}

describe("particles", () => {
  it("reborn particles start outside the edge they enter from", () => {
    const rand = seeded(7);
    for (let i = 0; i < 50; i++) {
      const sea = spawnParticle("summer", W, H, 0, false, rand);
      // Bubbles rise from below, shells and starfish sink from above.
      if (SINKING.has(sea.kind)) expect(sea.y).toBeLessThan(0);
      else expect(sea.y).toBeGreaterThan(H);
      const flake = spawnParticle("winter", W, H, 0, false, rand);
      expect(flake.y).toBeLessThan(0);
      const petal = spawnParticle("spring", W, H, 0, false, rand);
      expect(petal.x < 0 || petal.y < 0).toBe(true);
    }
  });

  it("spring mixes petals, blossoms (middle and near), sprigs (middle) and buds (far), keeping the band shares", () => {
    const rand = seeded(11);
    const spring = Array.from({ length: 6000 }, () => spawnParticle("spring", W, H, 0, true, rand));
    for (const [kind, share] of Object.entries(SEASONS.spring.shares)) {
      expect(spring.filter((p) => p.kind === kind).length / spring.length, kind).toBeCloseTo(share, 1);
    }
    const [lo, hi] = SEASONS.spring.ampPx;
    for (const p of spring) {
      if (p.kind === "blossom") expect(p.depth).toBeGreaterThan(0);
      if (p.kind === "sprig") expect(p.depth).toBe(1);
      if (p.kind === "bud") expect(p.depth).toBe(0);
      expect(p.amp).toBeGreaterThanOrEqual(lo);
      expect(p.amp).toBeLessThanOrEqual(hi);
    }
    SEASONS.bands.forEach((band, depth) => {
      expect(spring.filter((p) => p.depth === depth).length / spring.length).toBeCloseTo(band.share, 1);
    });
  });

  it("summer: bubbles (every band) and clusters rise, shells and starfish (middle and near) sink slowly and sway wider", () => {
    const rand = seeded(29);
    const summer = Array.from({ length: 6000 }, () => spawnParticle("summer", W, H, 0, true, rand));
    for (const [kind, share] of Object.entries(SEASONS.summer.shares)) {
      expect(summer.filter((p) => p.kind === kind).length / summer.length, kind).toBeCloseTo(share, 1);
    }
    const { rise, sink } = SEASONS.summer;
    for (const p of summer) {
      const wobble = SINKING.has(p.kind) ? sink : rise;
      if (p.kind !== "bubble") expect(p.depth, p.kind).toBeGreaterThan(0);
      expect(p.amp).toBeGreaterThanOrEqual(wobble.ampPx[0]);
      expect(p.amp).toBeLessThanOrEqual(wobble.ampPx[1]);
      expect(Math.sign(p.vy)).toBe(SINKING.has(p.kind) ? 1 : -1);
      // Bubbles stay upright.
      if (!SINKING.has(p.kind)) expect(p.sin).toBe(0);
    }
    SEASONS.bands.forEach((band, depth) => {
      expect(summer.filter((p) => p.depth === depth).length / summer.length).toBeCloseTo(band.share, 1);
    });
    // Sinking is slower than rising.
    const speed = (sinking: boolean) => {
      const ps = summer.filter((p) => SINKING.has(p.kind) === sinking && p.depth === 1);
      return ps.reduce((sum, p) => sum + Math.abs(p.vy), 0) / ps.length;
    };
    expect(speed(true)).toBeCloseTo(speed(false) * sink.speed, 0);
    // Starfish: 64 and 96 px across; a single bubble 31 / 56 / 90.
    expect([1, 2].map((d) => kindRadius("starfish", d) * 2)).toEqual([64, 96]);
    expect([0, 1, 2].map((d) => Math.round(kindRadius("bubble", d) * 2))).toEqual([31, 56, 90]);
  });

  it("autumn drops four leaf species by their shares, swaying wider than the other seasons", () => {
    const rand = seeded(17);
    const autumn = Array.from({ length: 4000 }, () => spawnParticle("autumn", W, H, 0, true, rand));
    for (const [kind, share] of Object.entries(SEASONS.leaves.shares)) {
      expect(autumn.filter((p) => p.kind === kind).length / autumn.length, kind).toBeCloseTo(share, 1);
    }
    const [lo, hi] = SEASONS.leaves.ampPx;
    for (const p of autumn) {
      expect(p.amp).toBeGreaterThanOrEqual(lo);
      expect(p.amp).toBeLessThanOrEqual(hi);
    }
  });

  it("winter mixes flakes, plates, soft dots (far only) and fir twigs (60 % middle, 40 % near), keeping the band shares", () => {
    const rand = seeded(19);
    const winter = Array.from({ length: 6000 }, () => spawnParticle("winter", W, H, 0, true, rand));
    for (const [kind, share] of Object.entries(SEASONS.winter.shares)) {
      expect(winter.filter((p) => p.kind === kind).length / winter.length, kind).toBeCloseTo(share, 1);
    }
    for (const p of winter) {
      if (p.kind === "dot") {
        expect(p.depth).toBe(0);
        expect(p.size).toBeLessThanOrEqual(SEASONS.winter.dotRadiusPx[1]);
      }
      if (p.kind === "fir") {
        expect(p.depth).toBeGreaterThanOrEqual(1);
        expect(p.amp).toBeGreaterThanOrEqual(SEASONS.winter.fir.ampPx[0]);
      }
    }
    const firs = winter.filter((p) => p.kind === "fir");
    SEASONS.winter.fir.bandSplit.forEach((split, depth) => {
      expect(firs.filter((p) => p.depth === depth).length / firs.length).toBeCloseTo(split, 1);
    });
    SEASONS.bands.forEach((band, depth) => {
      expect(winter.filter((p) => p.depth === depth).length / winter.length).toBeCloseTo(band.share, 1);
    });
  });

  it("winter gusts push a whole band sideways now and then, rising and falling", () => {
    const { everyS, pxPerS } = SEASONS.winter.gust;
    const gusts = new Gusts(0, seeded(23));
    let pushed = 0;
    let quietRun = 0;
    let longestQuiet = 0;
    for (let t = 0; t < 120_000; t += 50) {
      const v = gusts.velocity(1, t);
      expect(Math.abs(v)).toBeLessThanOrEqual(pxPerS);
      if (v !== 0) {
        pushed++;
        quietRun = 0;
      } else longestQuiet = Math.max(longestQuiet, (quietRun += 50));
    }
    // Pushed for about durationS out of every everyS.
    expect(pushed).toBeGreaterThan(0);
    expect(longestQuiet).toBeLessThanOrEqual(everyS[1] * 1000);
    // Asking again for the same time gives the same push: one gust for the whole band.
    const again = new Gusts(0, seeded(23));
    expect(again.velocity(1, 9000)).toBe(again.velocity(1, 9000));
  });

  it("a season arriving appears anywhere on screen", () => {
    const rand = seeded(3);
    for (const season of ["winter", "spring", "summer", "autumn"] as const) {
      const p = spawnParticle(season, W, H, 0, true, rand);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(W);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(H);
    }
  });

  it("bubbles rise, petals go down diagonally, leaves and flakes fall; all finish their path", () => {
    for (const season of ["summer", "spring", "autumn", "winter"] as const) {
      const { p, t } = lifetime(season);
      expect(t, season).toBeLessThan(600);
      if (p.vy < 0) expect(p.y).toBeLessThan(0);
      else expect(p.y > H || p.x > W).toBe(true);
    }
  });

  it("winter is the slowest to cross the window", () => {
    const average = (season: Season) => {
      const seeds = Array.from({ length: 20 }, (_, i) => i + 1);
      return seeds.reduce((sum, seed) => sum + lifetime(season, seeded(seed)).t, 0) / seeds.length;
    };
    expect(average("winter")).toBeGreaterThan(average("autumn"));
  });

  it("splits new particles into far, middle and near bands", () => {
    const rand = seeded(5);
    const ps = Array.from({ length: 4000 }, () => spawnParticle("autumn", W, H, 0, true, rand));
    SEASONS.bands.forEach((band, depth) => {
      const share = ps.filter((p) => p.depth === depth).length / ps.length;
      expect(share).toBeCloseTo(band.share, 1);
    });
    // Near particles are bigger and faster than far ones, on average.
    const mean = (depth: number, f: (p: (typeof ps)[number]) => number) => {
      const band = ps.filter((p) => p.depth === depth);
      return band.reduce((sum, p) => sum + f(p), 0) / band.length;
    };
    expect(mean(2, (p) => p.size)).toBeGreaterThan(mean(0, (p) => p.size) * 2);
    expect(mean(2, (p) => p.vy)).toBeGreaterThan(mean(0, (p) => p.vy) * 2);
  });

  it("never turns: a fixed tilt within ±tiltDeg, only moving and wobbling", () => {
    const rand = seeded(9);
    const limit = Math.cos((SEASONS.tiltDeg * Math.PI) / 180);
    for (const season of ["winter", "spring", "summer", "autumn"] as const) {
      const p = spawnParticle(season, W, H, 0, true, rand);
      expect(p.cos).toBeGreaterThanOrEqual(limit - 1e-9);
      const { cos, sin } = p;
      for (let t = 0; t < 10; t += 1 / 60) stepParticle(p, 1 / 60);
      expect([p.cos, p.sin]).toEqual([cos, sin]);
    }
  });

  it("wobbles sideways within its amplitude, scaled with the window height", () => {
    const rand = seeded(13);
    const [lo, hi] = SEASONS.wobbleAmpPx;
    for (let i = 0; i < 50; i++) {
      const p = spawnParticle("winter", W, 720, 0, true, rand);
      expect(p.amp).toBeGreaterThanOrEqual(lo * 0.75);
      expect(p.amp).toBeLessThanOrEqual(hi * 0.75);
      for (let t = 0; t < 10; t += 0.37) expect(Math.abs(wobbleX(p, t) - p.x)).toBeLessThanOrEqual(p.amp + 1e-9);
    }
    expect(viewScale(1080)).toBe(1);
    expect(viewScale(2160)).toBe(1.25);
  });

  it("fades in over fadeInMs from birth", () => {
    const p = spawnParticle("autumn", W, H, 1000, true, seeded());
    expect(fadeIn(p, 1000)).toBe(0);
    expect(fadeIn(p, 1000 + SEASONS.fadeInMs / 2)).toBeCloseTo(0.5);
    expect(fadeIn(p, 1000 + SEASONS.fadeInMs * 2)).toBe(1);
  });
});

describe("WheelPush", () => {
  const { gainPxPerS, bandFactor, maxPxPerS, decayMs, sign } = SEASONS.react;

  it("pushes with the content: forward in time → left (sign -1), more near than far", () => {
    expect(sign).toBe(-1);
    const push = new WheelPush();
    push.notch(1, 0);
    expect(push.velocity(1, 0)).toBe(-gainPxPerS);
    expect(push.velocity(0, 0)).toBeCloseTo(-gainPxPerS * bandFactor[0]);
    expect(push.velocity(2, 0)).toBeCloseTo(-gainPxPerS * bandFactor[2]);
    push.clear();
    push.notch(-1, 0);
    expect(push.velocity(1, 0)).toBe(gainPxPerS);
  });

  it("decays exponentially with decayMs", () => {
    const push = new WheelPush();
    push.notch(1, 1000);
    expect(push.velocity(1, 1000 + decayMs)).toBeCloseTo(sign * gainPxPerS * Math.exp(-1));
    expect(Math.abs(push.velocity(1, 1000 + decayMs * 10))).toBeLessThan(0.02);
  });

  it("notches add up, never past maxPxPerS on any band", () => {
    const push = new WheelPush();
    for (let t = 0; t < 1000; t += 30) push.notch(1, t);
    for (let depth = 0; depth < bandFactor.length; depth++) {
      expect(Math.abs(push.velocity(depth, 990))).toBeLessThanOrEqual(maxPxPerS);
    }
    expect(Math.abs(push.velocity(2, 990))).toBe(maxPxPerS);
  });

  it("clear stops it at once", () => {
    const push = new WheelPush();
    push.notch(1, 0);
    push.clear();
    expect(push.velocity(2, 0)).toBe(0);
  });
});
