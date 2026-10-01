import { describe, expect, it } from "vitest";
import { SEASONS } from "../timeline/config";
import { fadeIn, Gusts, isGone, spawnParticle, stepParticle, viewScale, wobbleX } from "./particles";
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
      const bubble = spawnParticle("summer", W, H, 0, false, rand);
      expect(bubble.y).toBeGreaterThan(H);
      const flake = spawnParticle("winter", W, H, 0, false, rand);
      expect(flake.y).toBeLessThan(0);
      const petal = spawnParticle("spring", W, H, 0, false, rand);
      expect(petal.x < 0 || petal.y < 0).toBe(true);
    }
  });

  it("now and then a spring particle is a whole cherry blossom", () => {
    const rand = seeded(11);
    const spring = Array.from({ length: 400 }, () => spawnParticle("spring", W, H, 0, true, rand));
    const share = spring.filter((p) => p.kind === "blossom").length / spring.length;
    expect(share).toBeGreaterThan(SEASONS.blossomChance / 2);
    expect(share).toBeLessThan(SEASONS.blossomChance * 2);
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

  it("winter mixes flakes, plates, soft dots (far only) and fir twigs (middle only), keeping the band shares", () => {
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
        expect(p.depth).toBe(1);
        expect(p.amp).toBeGreaterThanOrEqual(SEASONS.winter.fir.ampPx[0]);
      }
    }
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
      if (season === "summer") expect(p.y).toBeLessThan(0);
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
