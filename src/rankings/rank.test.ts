import { describe, expect, it } from "vitest";
import { makeGame, score } from "../test-utils";
import { parseDay } from "../timeline/dates";
import type { Game, Score } from "../types";
import { rank, type SortKey } from "./rank";

const today = parseDay("2026-09-27");

function scored(title: string, s: { oc?: Score; mc?: Score; mcu?: Score; bl?: Score }, date = "2026-01-01"): Game {
  return makeGame({
    title,
    firstReleaseDate: date,
    scores: {
      critic: { opencritic: s.oc ?? null, metacritic: s.mc ?? null },
      user: { metacritic: s.mcu ?? null, backloggd: s.bl ?? null },
    },
  });
}

const titles = (games: Game[], sort: SortKey, minReviews = 20) => rank(games, today, { sort, minReviews }).ranked.map((r) => r.game.title);

describe("rank: sources", () => {
  // Each game is best on a different source.
  const games = [
    scored("OC", { oc: score(95, 50), mc: score(60, 50), mcu: score(60, 50), bl: score(60, 50) }),
    scored("MC", { oc: score(60, 50), mc: score(95, 50), mcu: score(60, 50), bl: score(60, 50) }),
    scored("MCU", { oc: score(60, 50), mc: score(60, 50), mcu: score(95, 50), bl: score(60, 50) }),
    scored("BL", { oc: score(60, 50), mc: score(60, 50), mcu: score(60, 50), bl: score(95, 50) }),
  ];

  it.each([
    ["opencritic", "OC"],
    ["metacritic", "MC"],
    ["metacriticUser", "MCU"],
    ["backloggd", "BL"],
  ] as const)("sorts by %s", (sort, first) => {
    expect(titles(games, sort)[0]).toBe(first);
  });

  it("averages critics (OpenCritic + Metacritic) and users (Metacritic User + Backloggd)", () => {
    const g = [scored("A", { oc: score(90, 30), mc: score(70, 30), mcu: score(40, 30), bl: score(60, 30) })];
    expect(rank(g, today, { sort: "critics", minReviews: 20 }).ranked[0]).toMatchObject({ value: 80, count: 60, used: ["opencritic", "metacritic"] });
    expect(rank(g, today, { sort: "users", minReviews: 20 }).ranked[0]).toMatchObject({ value: 50, count: 60 });
  });

  it("uses only the sources above the threshold for an average", () => {
    const g = [scored("A", { oc: score(90, 30), mc: score(50, 5) })];
    expect(rank(g, today, { sort: "critics", minReviews: 20 }).ranked[0]).toMatchObject({ value: 90, count: 30, used: ["opencritic"] });
  });
});

describe("rank: ties", () => {
  it("puts more reviews first, then sorts by title", () => {
    const games = [scored("Beta", { oc: score(80, 40) }), scored("Alpha", { oc: score(80, 40) }), scored("Gamma", { oc: score(80, 90) })];
    expect(titles(games, "opencritic")).toEqual(["Gamma", "Alpha", "Beta"]);
  });
});

describe("rank: threshold and hidden games", () => {
  const games = [
    scored("Enough", { oc: score(80, 20) }),
    scored("Few", { oc: score(90, 19) }),
    scored("No score", {}),
    scored("Upcoming", { oc: score(99, 99) }, "2026-10-01"),
    makeGame({ title: "TBA", scores: scored("x", { oc: score(99, 99) }).scores }),
  ];

  it("keeps sources with at least minReviews and counts the other released games as hidden", () => {
    expect(rank(games, today, { sort: "opencritic", minReviews: 20 })).toMatchObject({ hidden: 2 });
    expect(titles(games, "opencritic")).toEqual(["Enough"]);
  });

  it("ranks every released score with a threshold of 0", () => {
    expect(titles(games, "opencritic", 0)).toEqual(["Few", "Enough"]);
  });

  it("counts a game released today", () => {
    expect(titles([scored("Today", { oc: score(80, 30) }, "2026-09-27")], "opencritic")).toEqual(["Today"]);
  });

  // docs/review/pages.md, "voti senza numero di recensioni": the rule is still to be decided
  // (count required in the admin panel, or `count: null` always above the threshold).
  it.todo("scores without a review count follow the chosen rule and are reported as such among the hidden games");
});
