import { describe, expect, it } from "vitest";
import { SEASONS } from "../timeline/config";
import { fadeIn, isGone, spawnParticle, stepParticle } from "./particles";
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
    stepParticle(p, 1 / 60, t);
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
    expect(lifetime("winter").t).toBeGreaterThan(lifetime("autumn").t);
  });

  it("fades in over fadeInMs from birth", () => {
    const p = spawnParticle("autumn", W, H, 1000, true, seeded());
    expect(fadeIn(p, 1000)).toBe(0);
    expect(fadeIn(p, 1000 + SEASONS.fadeInMs / 2)).toBeCloseTo(0.5);
    expect(fadeIn(p, 1000 + SEASONS.fadeInMs * 2)).toBe(1);
  });
});
