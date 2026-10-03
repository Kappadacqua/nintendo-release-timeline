import { describe, expect, it } from "vitest";
import { SEASONS } from "../timeline/config";
import { parseDay, dayToDate } from "../timeline/dates";
import { backgroundShown, particleCount, seasonOf, SeasonState } from "./season";

const season = (iso: string) => seasonOf(dayToDate(parseDay(iso)));

describe("seasonOf", () => {
  // Last day of the old season, first day of the new one (Italian time, USNO).
  const boundaries: [string, string, string][] = [
    ["2025-03-19", "2025-03-20", "spring"],
    ["2025-06-20", "2025-06-21", "summer"],
    ["2025-09-21", "2025-09-22", "autumn"],
    ["2025-12-20", "2025-12-21", "winter"],
    ["2026-03-19", "2026-03-20", "spring"],
    ["2026-06-20", "2026-06-21", "summer"],
    ["2026-09-22", "2026-09-23", "autumn"],
    ["2026-12-20", "2026-12-21", "winter"],
    ["2027-03-19", "2027-03-20", "spring"],
    ["2027-06-20", "2027-06-21", "summer"],
    ["2027-09-22", "2027-09-23", "autumn"],
    ["2027-12-21", "2027-12-22", "winter"],
  ];
  const before: Record<string, string> = { spring: "winter", summer: "spring", autumn: "summer", winter: "autumn" };

  it.each(boundaries)("%s → %s starts the new season", (last, first, starts) => {
    expect(season(last)).toBe(before[starts]);
    expect(season(first)).toBe(starts);
  });

  it("uses the table of each year (2028 summer on Jun 20)", () => {
    expect(season("2028-06-19")).toBe("spring");
    expect(season("2028-06-20")).toBe("summer");
  });

  it("falls back to Mar 20 / Jun 21 / Sep 22 / Dec 21 outside the table", () => {
    expect(season("2031-03-19")).toBe("winter");
    expect(season("2031-03-20")).toBe("spring");
    expect(season("2031-06-20")).toBe("spring");
    expect(season("2031-06-21")).toBe("summer");
    expect(season("2031-09-21")).toBe("summer");
    expect(season("2031-09-22")).toBe("autumn");
    expect(season("2031-12-20")).toBe("autumn");
    expect(season("2031-12-21")).toBe("winter");
  });

  it("keeps winter across the new year and the 1st of the month no longer matters", () => {
    expect(season("2026-01-01")).toBe("winter");
    expect(season("2026-03-01")).toBe("winter");
    expect(season("2026-09-01")).toBe("summer");
    expect(season("2025-06-05")).toBe("spring");
  });
});

describe("particleCount", () => {
  it("is 25 at 1280 × 720 and 50 at 2560 × 1440 or larger", () => {
    expect(particleCount(1280, 720)).toBe(25);
    expect(particleCount(2560, 1440)).toBe(50);
    expect(particleCount(3840, 2160)).toBe(50);
  });

  it("falls to 12 on a phone (360 × 640 or smaller)", () => {
    expect(particleCount(360, 640)).toBe(12);
    expect(particleCount(320, 480)).toBe(12);
    expect(particleCount(800, 600)).toBe(17);
    expect(particleCount(1024, 768)).toBeLessThanOrEqual(25);
  });

  it("grows with the window area in between", () => {
    const hd = particleCount(1920, 1080);
    expect(hd).toBe(35);
  });
});

describe("SeasonState", () => {
  const { crossDelayMs: delay, crossInMs: inMs, crossOutMs: outMs } = SEASONS;

  it("the first season starts at once, at full weight", () => {
    const s = new SeasonState();
    expect(s.set("winter", 0)).toBe(true);
    expect(s.weight("winter", 0)).toBe(1);
    expect(s.target("winter", 40, 0)).toBe(40);
    expect(s.weight("autumn", 0)).toBe(0);
  });

  it("the same season again changes nothing", () => {
    const s = new SeasonState();
    s.set("summer", 0);
    expect(s.set("summer", 5000)).toBe(false);
    expect(s.target("summer", 30, 5000)).toBe(30);
  });

  it("cross-fades: the new season rises after the delay, the old one sinks at once", () => {
    const s = new SeasonState();
    s.set("autumn", 0);
    s.set("winter", 1000);
    expect(s.weight("winter", 1000 + delay)).toBe(0);
    expect(s.weight("autumn", 1000)).toBe(1);
    expect(s.rising("winter", 1000 + delay + 1)).toBe(true);
    // Ease-in-out in, linear out: a quarter in the new one is still low, halfway both are at half.
    expect(s.weight("winter", 1000 + delay + inMs / 4)).toBeCloseTo(0.125);
    expect(s.weight("winter", 1000 + delay + inMs / 2)).toBeCloseTo(0.5);
    expect(s.weight("autumn", 1000 + outMs / 4)).toBeCloseTo(0.75);
    expect(s.weight("autumn", 1000 + outMs / 2)).toBeCloseTo(0.5);
    // For a while both are on screen.
    expect(s.weight("winter", 1000 + 1000)).toBeGreaterThan(0);
    expect(s.weight("autumn", 1000 + 1000)).toBeGreaterThan(0);
    expect(s.weight("autumn", 1000 + outMs)).toBe(0);
    expect(s.weight("winter", 1000 + delay + inMs)).toBe(1);
    expect(s.target("winter", 30, 1000 + delay + inMs)).toBe(30);
    expect(s.rising("winter", 1000 + delay + inMs)).toBe(false);
  });

  it("weights only move smoothly, also back and forth across the boundary", () => {
    const s = new SeasonState();
    s.set("autumn", 0);
    const changes: [number, "autumn" | "winter"][] = [
      [1000, "winter"],
      [1600, "autumn"],
      [2100, "winter"],
      [2400, "autumn"],
    ];
    let prev = { autumn: 1, winter: 0 };
    for (let t = 0; t <= 8000; t += 4) {
      for (const [at, season] of changes) if (at === t) s.set(season, t);
      const now = { autumn: s.weight("autumn", t), winter: s.weight("winter", t) };
      expect(Math.abs(now.autumn - prev.autumn)).toBeLessThan(0.02);
      expect(Math.abs(now.winter - prev.winter)).toBeLessThan(0.02);
      prev = now;
    }
    expect(prev).toEqual({ autumn: 1, winter: 0 });
  });

  it("a season coming back resumes from its current weight", () => {
    const s = new SeasonState();
    s.set("spring", 0);
    s.set("summer", 0);
    const w = s.weight("spring", 500);
    s.set("spring", 500);
    expect(s.weight("spring", 500)).toBeCloseTo(w);
    expect(s.weight("spring", 500 + delay)).toBeCloseTo(w);
    expect(s.weight("spring", 500 + delay + 1)).toBeGreaterThan(w);
  });

  it("immediate (reduced motion) and settle() skip the cross-fade", () => {
    const s = new SeasonState();
    s.set("spring", 0);
    s.set("summer", 100, true);
    expect(s.weights(100)).toEqual({ winter: 0, spring: 0, summer: 1, autumn: 0 });
    s.set("autumn", 200);
    s.settle();
    expect(s.weights(200)).toEqual({ winter: 0, spring: 0, summer: 0, autumn: 1 });
  });
});

describe("backgroundShown", () => {
  const base = { enabled: true, selected: false, pageVisible: true };

  it("shows while browsing", () => expect(backgroundShown(base)).toBe(true));
  it("hides with a game selected", () => expect(backgroundShown({ ...base, selected: true })).toBe(false));
  it("stops with the page in the background", () => expect(backgroundShown({ ...base, pageVisible: false })).toBe(false));
  it("stays off when switched off", () => expect(backgroundShown({ ...base, enabled: false })).toBe(false));
});
