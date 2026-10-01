import { describe, expect, it } from "vitest";
import { makeGame } from "../../src/test-utils";
import { gapsOf } from "./gaps";
import type { MetacriticCache } from "./metacritic";

const today = "2026-10-01";
const checkedAt = "2026-09-30T10:00:00Z";
const mc = (games: MetacriticCache["games"]): MetacriticCache => ({ games });

describe("gapsOf", () => {
  it("says why a Metacritic score is missing", () => {
    const games = [
      makeGame({ id: "igdb:1", title: "Never looked up", firstReleaseDate: "2026-01-01" }),
      makeGame({ id: "igdb:2", title: "No page", firstReleaseDate: "2026-01-01" }),
      makeGame({ id: "igdb:3", title: "Few reviews", firstReleaseDate: "2026-01-01" }),
    ];
    const cache = mc({
      "igdb:2": { slug: "no-page", url: "", status: "not-found", checkedAt },
      "igdb:3": { slug: "few-reviews", url: "", status: "ok", checkedAt, critic: null, user: null, criticTbd: true },
    });
    const { scores } = gapsOf(games, {}, cache, today);
    const states = Object.fromEntries(scores.map((g) => [g.title, g.gaps.map((x) => `${x.source}: ${x.state}`)]));
    expect(states["Never looked up"]).toContain("Metacritic critic: not looked up");
    expect(states["No page"]).toContain("Metacritic user: no page found");
    expect(states["Few reviews"]).toEqual(["Metacritic critic: tbd", "Metacritic user: no score on the page"]);
  });

  it("leaves out sources confirmed absent, and counts them", () => {
    const game = makeGame({ id: "igdb:1", title: "Checked", firstReleaseDate: "2026-01-01" });
    const none = { status: "none" as const, reason: "no page", checkedAt: "2026-10-01" };
    const { scores, links, confirmedNone } = gapsOf([game], { "igdb:1": { absent: { metacritic: none, backloggd: none, wikipedia: none, nintendoWiki: none, nintendoStore: none } } }, mc({}), today);
    expect(scores).toEqual([]);
    expect(links).toEqual([]);
    expect(confirmedNone).toEqual({ metacritic: 1, backloggd: 1, wikipedia: 1, nintendoWiki: 1, nintendoStore: 1 });
  });

  it("treats a page Metacritic removed (410) as confirmed absent", () => {
    const game = makeGame({ id: "igdb:1", title: "Derby Stallion 2", firstReleaseDate: "2026-09-24" });
    const cache = mc({ "igdb:1": { slug: "derby-stallion-2", url: "", status: "gone", httpStatus: 410, checkedAt } });
    const { scores, confirmedNone } = gapsOf([game], {}, cache, today);
    expect(scores).toEqual([]);
    expect(confirmedNone.metacritic).toBe(1);
  });

  it("counts missing Backloggd values instead of listing them", () => {
    const games = [makeGame({ id: "igdb:1", title: "A", firstReleaseDate: "2026-01-01" }), makeGame({ id: "igdb:2", title: "B", firstReleaseDate: "2026-01-01" })];
    const cache = mc({
      "igdb:1": { slug: "a", url: "", status: "ok", checkedAt, critic: 80, user: 8 },
      "igdb:2": { slug: "b", url: "", status: "ok", checkedAt, critic: 80, user: 8 },
    });
    games.forEach((g) => {
      g.scores.critic.metacritic = { value: 80, scale: 100, normalized: 80, count: 10 };
      g.scores.user.metacritic = { value: 8, scale: 10, normalized: 80, count: 10 };
    });
    const { scores, backloggdMissing } = gapsOf(games, {}, cache, today);
    expect(scores).toEqual([]);
    expect(backloggdMissing).toBe(2);
  });

  it("skips games not out yet, and the TBA zone for links", () => {
    const upcoming = makeGame({ id: "igdb:1", title: "Upcoming", firstReleaseDate: "2026-12-01" });
    const tba = makeGame({ id: "igdb:2", title: "TBA", firstReleaseDate: null, vagueRelease: { year: 2027, label: "2027" } });
    const { scores, links } = gapsOf([upcoming, tba], {}, mc({}), today);
    expect(scores).toEqual([]);
    expect(links.map((g) => g.id)).toEqual(["igdb:1"]);
  });
});
