import { describe, expect, it } from "vitest";
import { computeFreshness, type FreshnessInput } from "./freshness";
import { isDueAfter, metacriticMaxDays, researchDays, scoreRefreshDays } from "./refresh-policy";

const now = Date.parse("2026-10-03T12:00:00Z");
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();
const game = (id: string, released: string | null, extra: Partial<FreshnessInput["games"][number]> = {}) => ({
  id,
  kind: "game",
  firstReleaseDate: released,
  links: {},
  ...extra,
});
const input = (over: Partial<FreshnessInput>): FreshnessInput => ({
  games: [],
  igdb: null,
  wikipedia: null,
  links: null,
  freeUpdates: null,
  studios: null,
  opencritic: null,
  metacritic: null,
  fetchStatus: null,
  ...over,
});

describe("refresh policy", () => {
  it("reads new games often and old ones rarely", () => {
    expect([0, 13, 14, 27, 28, 83, 84, 400].map(scoreRefreshDays)).toEqual([1, 1, 3, 3, 7, 7, 30, 30]);
    expect(researchDays(-20)).toBe(7); // not out yet: weekly
    expect(researchDays(20)).toBe(3);
    expect(metacriticMaxDays("ok", 20)).toBe(3);
    expect(metacriticMaxDays("not-found", 100)).toBe(30);
    expect(metacriticMaxDays("mismatch", 40)).toBe(7);
    expect(metacriticMaxDays("gone", 1)).toBeNull();
  });

  it("counts a run up to 2 hours earlier than the day before as a day later", () => {
    const now = Date.parse("2026-11-14T10:27:00Z");
    expect(isDueAfter("2026-11-13T10:56:00Z", 1, now)).toBe(true); // the drift seen on the daily cron
    expect(isDueAfter("2026-11-13T13:00:00Z", 1, now)).toBe(false);
  });
});

describe("computeFreshness", () => {
  it("dates each game's next read from its age", () => {
    const r = computeFreshness(
      input({
        games: [game("igdb:1", "2026-09-28", { links: { opencritic: "https://opencritic.com/game/7/x" } }), game("igdb:2", "2025-06-05")],
        opencritic: { games: { "7": { fetchedAt: daysAgo(2) } }, matches: { "igdb:2": { opencriticId: null, searchedAt: daysAgo(3) } } },
        metacritic: { games: { "igdb:2": { status: "ok", checkedAt: daysAgo(3) } } },
      }),
      now,
    );
    // Five days old: OpenCritic daily, due again (read two days ago).
    expect(r.games["igdb:1"].opencritic).toEqual({ checkedAt: daysAgo(2), nextAt: daysAgo(1), note: "score read (id 7)" });
    expect(r.games["igdb:1"].metacritic).toEqual({ checkedAt: null, nextAt: null, note: "never looked up" });
    // Over a year old: Metacritic monthly, OpenCritic miss searched again after 30 days.
    expect(r.games["igdb:2"].metacritic!.nextAt).toBe(daysAgo(-27));
    expect(r.games["igdb:2"].opencritic!.nextAt).toBe(daysAgo(-27));
    expect(r.sources.find((s) => s.key === "opencritic")!.detail).toContain("1 due at the next fetch");
    expect(r.sources.find((s) => s.key === "metacritic")!.detail).toContain("1 due at the next fetch");
  });

  it("skips upcoming games, TBA games and free updates; a removed page is never read again", () => {
    const r = computeFreshness(
      input({
        games: [game("a", "2026-12-01"), game("b", null), game("c", "2025-06-05", { kind: "free-update" }), game("d", "2026-01-01")],
        metacritic: { games: { d: { status: "gone", checkedAt: daysAgo(1) } } },
      }),
      now,
    );
    expect(Object.keys(r.games)).toEqual(["d"]);
    expect(r.games.d.metacritic!.nextAt).toBeNull();
  });

  it("takes each source's latest date and the last run's budget", () => {
    const r = computeFreshness(
      input({
        igdb: { fetchedAt: daysAgo(1) },
        metacritic: { games: { x: { status: "ok", checkedAt: daysAgo(5) }, y: { status: "ok", checkedAt: daysAgo(1) } } },
        fetchStatus: {
          fetchedAt: daysAgo(1),
          opencritic: { enabled: true, searchesUsed: 2, requestsUsed: 30, budgetExhausted: true, stoppedBecause: null },
          metacritic: { enabled: true, due: 4, checked: 3, requestsUsed: 9, budgetExhausted: false, stoppedBecause: "HTTP 403" },
        },
      }),
      now,
    );
    expect(r.sources.find((s) => s.key === "igdb")!.updatedAt).toBe(daysAgo(1));
    expect(r.sources.find((s) => s.key === "metacritic")!.updatedAt).toBe(daysAgo(1));
    expect(r.lastRun).toEqual({
      at: daysAgo(1),
      opencritic: "2 searches, 30 requests · budget reached",
      metacritic: "3 of 4 due checked, 9 requests · stopped: HTTP 403",
    });
  });
});
