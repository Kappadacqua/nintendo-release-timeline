import { describe, expect, it } from "vitest";
import { parseDay } from "../timeline/dates";
import type { Studio, StudioGame } from "../types";
import { relative, shownGame, sortStudios } from "./order";

const today = parseDay("2026-09-27");

const game = (date: string): StudioGame => ({ id: `g:${date}`, title: date, coverUrl: "", date, status: "released" });
const studio = (name: string, date: string | null, hasSwitch2Game = true): Studio => ({
  name,
  url: null,
  category: "first-party",
  game: date ? game(date) : null,
  hasSwitch2Game,
});

describe("relative (Studios card)", () => {
  it("names today, tomorrow and yesterday", () => {
    expect(relative(0)).toBe("Out today");
    expect(relative(1)).toBe("Upcoming · tomorrow");
    expect(relative(-1)).toBe("Released yesterday");
  });

  it("counts days, months and years", () => {
    expect(relative(26)).toBe("Upcoming · in 26 days");
    expect(relative(-92)).toBe("Released 3 months ago");
    expect(relative(-800)).toBe("Released 2 years ago");
  });
});

describe("shownGame", () => {
  it("hides the game of a studio without a Switch 2 game", () => {
    expect(shownGame(studio("A", "2026-01-01", false))).toBeNull();
    expect(shownGame(studio("A", "2026-01-01"))?.date).toBe("2026-01-01");
  });
});

describe("sortStudios", () => {
  it("puts upcoming (soonest first), then released (latest first), then no game (alphabetical)", () => {
    const list = [
      studio("Released old", "2025-07-01"),
      studio("Zeta no game", null),
      studio("Upcoming far", "2027-01-01"),
      studio("Switch 1 only", "2026-12-01", false),
      studio("Released recent", "2026-09-01"),
      studio("Upcoming soon", "2026-10-01"),
      studio("Alpha no game", null),
    ];
    expect(sortStudios(list, today).map((s) => s.name)).toEqual([
      "Upcoming soon",
      "Upcoming far",
      "Released recent",
      "Released old",
      "Alpha no game",
      "Switch 1 only",
      "Zeta no game",
    ]);
  });

  it("counts a game out today as upcoming and breaks date ties by name", () => {
    const list = [studio("B", "2026-09-27"), studio("A", "2026-09-27"), studio("C", "2026-09-26")];
    expect(sortStudios(list, today).map((s) => s.name)).toEqual(["A", "B", "C"]);
  });
});
