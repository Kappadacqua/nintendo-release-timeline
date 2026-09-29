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
  it("ramps the new season's particles up over about 2 s", () => {
    const s = new SeasonState();
    expect(s.set("autumn", 1000)).toBe(true);
    expect(s.target(40, 1000)).toBe(0);
    expect(s.target(40, 1000 + SEASONS.rampMs / 2)).toBe(20);
    expect(s.target(40, 1000 + SEASONS.rampMs)).toBe(40);
    expect(s.target(40, 1000 + SEASONS.rampMs * 5)).toBe(40);
  });

  it("the same season again changes nothing", () => {
    const s = new SeasonState();
    s.set("summer", 0);
    expect(s.set("summer", 5000)).toBe(false);
    expect(s.target(30, 5000)).toBe(30);
  });

  it("after a change the old season's particles are never reborn, the new one's appear gradually", () => {
    const s = new SeasonState();
    s.set("summer", 0);
    expect(s.mayBirth("summer", 10, 30, 10_000)).toBe(true);
    s.set("autumn", 10_000);
    expect(s.mayBirth("summer", 0, 30, 10_001)).toBe(false);
    expect(s.mayBirth("autumn", 0, 30, 10_000)).toBe(false);
    expect(s.mayBirth("autumn", 0, 30, 10_000 + SEASONS.rampMs / 2)).toBe(true);
    expect(s.mayBirth("autumn", 15, 30, 10_000 + SEASONS.rampMs / 2)).toBe(false);
    expect(s.mayBirth("autumn", 29, 30, 10_000 + SEASONS.rampMs)).toBe(true);
    expect(s.mayBirth("autumn", 30, 30, 10_000 + SEASONS.rampMs)).toBe(false);
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
