import { describe, expect, it, vi } from "vitest";
import { makeGame } from "../test-utils";
import { parseDay } from "../timeline/dates";

// expand.ts reads prefers-reduced-motion when loaded: Node has no matchMedia.
vi.hoisted(() => {
  globalThis.matchMedia = (() => ({ matches: false })) as unknown as typeof matchMedia;
});

const { relativeRelease } = await import("./expand");

const today = parseDay("2026-09-27");
const on = (date: string | null) => makeGame({ title: "Game", firstReleaseDate: date });

describe("relativeRelease (timeline card)", () => {
  it("names today, tomorrow and yesterday", () => {
    expect(relativeRelease(on("2026-09-27"), today)).toBe("Out today");
    expect(relativeRelease(on("2026-09-28"), today)).toBe("Out tomorrow");
    expect(relativeRelease(on("2026-09-26"), today)).toBe("Released yesterday");
  });

  it("counts days, then months, in both directions", () => {
    expect(relativeRelease(on("2026-10-09"), today)).toBe("Out in 12 days");
    expect(relativeRelease(on("2026-06-27"), today)).toBe("Released 3 months ago");
  });

  it("crosses the year", () => {
    expect(relativeRelease(on("2027-01-01"), parseDay("2026-12-25"))).toBe("Out in 7 days");
  });

  it("falls back to the vague date, then TBA", () => {
    expect(relativeRelease(makeGame({ title: "G", vagueRelease: { year: 2027, label: "2027" } }), today)).toBe("Expected 2027");
    expect(relativeRelease(on(null), today)).toBe("Release date TBA");
  });
});
