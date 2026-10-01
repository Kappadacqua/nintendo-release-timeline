import { describe, expect, it } from "vitest";
import { SEASONS } from "../timeline/config";
import { parseDay, dayToDate } from "../timeline/dates";
import { backgroundShown, particleCount, ScrollGate, seasonOf, SeasonState } from "./season";

const season = (iso: string) => seasonOf(dayToDate(parseDay(iso)));

describe("seasonOf", () => {
  it("uses whole months: winter Dec–Feb, spring Mar–May, summer Jun–Aug, autumn Sep–Nov", () => {
    expect(season("2025-12-01")).toBe("winter");
    expect(season("2026-01-15")).toBe("winter");
    expect(season("2026-02-28")).toBe("winter");
    expect(season("2026-03-01")).toBe("spring");
    expect(season("2026-05-31")).toBe("spring");
    expect(season("2026-06-01")).toBe("summer");
    expect(season("2025-06-05")).toBe("summer");
    expect(season("2026-08-31")).toBe("summer");
    expect(season("2026-09-01")).toBe("autumn");
    expect(season("2026-11-30")).toBe("autumn");
  });

  it("switches exactly at midnight of the 1st (UTC fields, any time zone)", () => {
    expect(season("2026-11-30")).toBe("autumn");
    expect(season("2026-12-01")).toBe("winter");
    expect(season("2028-02-29")).toBe("winter");
  });
});

describe("particleCount", () => {
  it("is 20 at 1280 × 720 or smaller and 40 at 2560 × 1440 or larger", () => {
    expect(particleCount(1280, 720)).toBe(20);
    expect(particleCount(800, 600)).toBe(20);
    expect(particleCount(2560, 1440)).toBe(40);
    expect(particleCount(3840, 2160)).toBe(40);
  });

  it("grows with the window area in between", () => {
    const hd = particleCount(1920, 1080);
    expect(hd).toBeGreaterThan(20);
    expect(hd).toBeLessThan(40);
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
    // Ease-out in, ease-in out: halfway the new one is past half, the old one still above half.
    expect(s.weight("winter", 1000 + delay + inMs / 2)).toBeGreaterThan(0.5);
    expect(s.weight("autumn", 1000 + outMs / 2)).toBeGreaterThan(0.5);
    // For a while both are on screen.
    expect(s.weight("winter", 1000 + 1000)).toBeGreaterThan(0);
    expect(s.weight("autumn", 1000 + 1000)).toBeGreaterThan(0);
    expect(s.weight("autumn", 1000 + outMs)).toBe(0);
    expect(s.weight("winter", 1000 + delay + inMs)).toBe(1);
    expect(s.target("winter", 30, 1000 + delay + inMs)).toBe(30);
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

describe("ScrollGate", () => {
  it("is shown until a fast scroll", () => {
    const g = new ScrollGate();
    g.moved(0);
    expect(g.shown(10)).toBe(true);
    g.fast(100);
    expect(g.shown(100)).toBe(false);
  });

  it("comes back restMs after the last move, not after the fast one", () => {
    const g = new ScrollGate();
    g.fast(0);
    g.moved(300);
    g.moved(600);
    expect(g.shown(600 + SEASONS.restMs - 1)).toBe(false);
    expect(g.backAt).toBe(600 + SEASONS.restMs);
    expect(g.shown(600 + SEASONS.restMs)).toBe(true);
  });

  it("slow moves never hide it", () => {
    const g = new ScrollGate();
    for (let t = 0; t < 1000; t += 16) g.moved(t);
    expect(g.shown(1000)).toBe(true);
  });
});

describe("backgroundShown", () => {
  const base = { enabled: true, selected: false, pageVisible: true, scrolling: false };

  it("shows while browsing", () => expect(backgroundShown(base)).toBe(true));
  it("hides with a game selected", () => expect(backgroundShown({ ...base, selected: true })).toBe(false));
  it("hides while scrolling fast", () => expect(backgroundShown({ ...base, scrolling: true })).toBe(false));
  it("stops with the page in the background", () => expect(backgroundShown({ ...base, pageVisible: false })).toBe(false));
  it("stays off when switched off", () => expect(backgroundShown({ ...base, enabled: false })).toBe(false));
});
