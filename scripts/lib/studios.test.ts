import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeGame } from "../../src/test-utils";
import type { Game } from "../../src/types";
import type { FandomStudio, StudiosOverrides } from "./fandom";
import { buildStudios, isNintendoPublisher, normalizeStudio, type StudioGameInfo } from "./studios";

// The Nintendo Wiki cache and the overrides come from the test, not from data/.
const files = vi.hoisted(() => ({ studios: [] as unknown[], overrides: {} as Record<string, unknown> }));
vi.mock("./cache", () => ({ readJson: () => ({ fetchedAt: "", source: "", studios: files.studios }) }));
vi.mock("./fandom", () => ({ loadStudiosOverrides: () => files.overrides }));

const wiki = (title: string, active = true): FandomStudio => ({
  title,
  url: `https://wiki/${title}`,
  categories: [],
  defunct: "",
  active,
  uncertain: false,
});

// Platforms and publisher are test-only fields read by `info`.
type TestGame = Game & { s1?: boolean; s2?: boolean; byNintendo?: boolean };
const info: StudioGameInfo = {
  onSwitch2: (g) => (g as TestGame).s2 ?? true,
  onSwitch1: (g) => !!(g as TestGame).s1,
  byNintendo: (g) => !!(g as TestGame).byNintendo,
};
const game = (title: string, developer: string | null, date: string | null, extra: Partial<TestGame> = {}): TestGame => ({
  ...makeGame({ title, developer, firstReleaseDate: date }),
  ...extra,
});

const TODAY = "2026-09-27";
const build = (games: Game[]) => buildStudios(games, info, TODAY);
const byName = (games: Game[], name: string) => build(games).studios.find((s) => s.name === name);

beforeEach(() => {
  files.studios = [];
  files.overrides = {};
});

describe("normalizeStudio", () => {
  it("ignores case, accents, punctuation, '&' and company suffixes", () => {
    expect(normalizeStudio("Nintendo Co., Ltd.")).toBe("nintendo");
    expect(normalizeStudio("MONOLITH SOFT Inc.")).toBe("monolith soft");
    expect(normalizeStudio("Pokémon Works")).toBe("pokemon works");
    expect(normalizeStudio("Koei Tecmo & Omega Force")).toBe(normalizeStudio("Koei Tecmo and Omega Force"));
  });
});

describe("isNintendoPublisher", () => {
  it("accepts Nintendo, its branches and The Pokémon Company", () => {
    expect(isNintendoPublisher("Nintendo")).toBe(true);
    expect(isNintendoPublisher("Nintendo of America")).toBe(true);
    expect(isNintendoPublisher("The Pokémon Company")).toBe(true);
    expect(isNintendoPublisher("Bandai Namco Entertainment")).toBe(false);
  });
});

describe("buildStudios: categories", () => {
  it("makes wiki studios first party, with their page", () => {
    files.studios = [wiki("Nintendo EPD")];
    expect(byName([game("Mario", "Nintendo EPD", "2026-01-01", { firstParty: true })], "Nintendo EPD")).toMatchObject({
      category: "first-party",
      url: "https://wiki/Nintendo EPD",
    });
  });

  it("shows active wiki studios without games too", () => {
    files.studios = [wiki("Nintendo EPD")];
    expect(byName([], "Nintendo EPD")).toMatchObject({ category: "first-party", game: null, hasSwitch2Game: false });
  });

  it("makes the developer of a game published by Nintendo a partner", () => {
    const games = [game("Kirby", "HAL Laboratory", "2026-01-01", { byNintendo: true, firstParty: true })];
    expect(byName(games, "HAL Laboratory")).toMatchObject({ category: "partner", url: null });
  });

  it("makes the developer of an exclusive published by others third party", () => {
    const games = [game("Elden Ring Tarnished", "FromSoftware", null, { exclusivity: "exclusive" })];
    expect(byName(games, "FromSoftware")?.category).toBe("third-party");
  });

  it("leaves out other developers, DLC and free updates", () => {
    const games = [
      game("Port", "Someone", "2026-01-01"),
      game("DLC", "DLC Studio", "2026-01-01", { kind: "dlc", byNintendo: true }),
      game("Update", "Update Studio", "2026-01-01", { kind: "free-update", byNintendo: true }),
    ];
    expect(build(games).studios).toEqual([]);
  });

  it("does not show closed or hidden wiki studios, nor give their games to anyone", () => {
    files.studios = [wiki("Nintendo"), wiki("Old Studio", false)];
    files.overrides = { Nintendo: { hidden: true } };
    const games = [game("A", "Nintendo", "2026-01-01", { byNintendo: true }), game("B", "Old Studio", "2026-01-01", { byNintendo: true })];
    expect(build(games).studios).toEqual([]);
  });
});

describe("buildStudios: aliases", () => {
  it("merges IGDB names of a wiki studio (igdbNames)", () => {
    files.studios = [wiki("Nintendo Cube")];
    files.overrides = { "Nintendo Cube": { igdbNames: ["NDCube"] } };
    expect(byName([game("Party", "NDcube Co., Ltd.", "2026-01-01")], "Nintendo Cube")?.game?.title).toBe("Party");
  });

  it("merges the names of a partner or third party under the override's name", () => {
    files.overrides = { Konami: { igdbNames: ["Konami Digital Entertainment"] } };
    const games = [
      game("A", "Konami Digital Entertainment", "2026-01-01", { exclusivity: "exclusive" }),
      game("B", "Konami", "2026-03-01", { exclusivity: "exclusive" }),
    ];
    const studios = build(games).studios;
    expect(studios.map((s) => s.name)).toEqual(["Konami"]);
    expect(studios[0].game?.title).toBe("B");
  });

  it("hides an alias marked hidden", () => {
    files.overrides = { Konami: { hidden: true } };
    expect(build([game("A", "Konami", "2026-01-01", { exclusivity: "exclusive" })]).studios).toEqual([]);
  });
});

describe("buildStudios: shown game", () => {
  beforeEach(() => {
    files.studios = [wiki("EPD")];
  });

  it("shows the next game out", () => {
    const games = [game("Old", "EPD", "2025-07-01"), game("Far", "EPD", "2027-03-01"), game("Soon", "EPD", "2026-11-01")];
    expect(byName(games, "EPD")?.game).toMatchObject({ title: "Soon", status: "upcoming" });
  });

  it("otherwise shows the latest released one", () => {
    const games = [game("Old", "EPD", "2025-07-01"), game("Recent", "EPD", "2026-05-01"), game("TBA", "EPD", null)];
    expect(byName(games, "EPD")?.game).toMatchObject({ title: "Recent", status: "released" });
  });

  it("shows nothing when every game is TBA", () => {
    expect(byName([game("TBA", "EPD", null)], "EPD")).toMatchObject({ game: null, hasSwitch2Game: true });
  });

  it("gives an undated Switch 2 game to a studio without a dated one", () => {
    const games = [game("TBA b", "EPD", null), game("TBA a", "EPD", null)];
    expect(byName(games, "EPD")).toMatchObject({ game: null, tbaGame: { title: "TBA a" } });
    expect(byName([...games, game("Dated", "EPD", "2025-07-01")], "EPD")?.tbaGame).toBeUndefined();
  });

  it("gives the latest Switch 1 game to a studio without a Switch 2 game", () => {
    const games = [game("S1 old", "EPD", "2025-01-01", { s1: true, s2: false }), game("S1 new", "EPD", "2025-08-01", { s1: true, s2: false })];
    expect(byName(games, "EPD")).toMatchObject({ hasSwitch2Game: false, latestSwitch1Game: { title: "S1 new" } });
  });

  // docs/review/pages.md, [alta] "uno studio con un gioco Switch 2 può mostrare un gioco Switch 1".
  it("never shows a Switch 1 game for a studio with a Switch 2 game", () => {
    const games = [game("S2 TBA", "EPD", null), game("S1 dated", "EPD", "2026-12-01", { s1: true, s2: false })];
    expect(byName(games, "EPD")?.game).toBeNull();
    const later = [game("S2", "EPD", "2026-05-01"), game("S1 later", "EPD", "2026-12-01", { s1: true, s2: false })];
    expect(byName(later, "EPD")?.game?.title).toBe("S2");
  });

  // docs/review/pages.md, [media] "il gioco mostrato è fissato al momento della build, in UTC":
  // the page counts a game out today as upcoming (days >= 0), and so does the build.
  it("treats a game out on the build day as upcoming, like the page", () => {
    const games = [game("Today", "EPD", TODAY), game("Next", "EPD", "2026-12-01")];
    expect(byName(games, "EPD")?.game).toMatchObject({ title: "Today", status: "upcoming" });
  });

  it("orders studios: upcoming soonest first, released latest first, then no game", () => {
    files.studios = [wiki("A"), wiki("B"), wiki("C"), wiki("D")];
    const games = [game("a", "A", "2025-07-01"), game("b", "B", "2027-01-01"), game("c", "C", "2026-10-01")];
    expect(build(games).studios.map((s) => s.name)).toEqual(["C", "B", "A", "D"]);
  });
});

describe("buildStudios: unmatched developers", () => {
  it("lists first-party games without a developer, or whose developer is not a studio or partner", () => {
    const games = [game("No dev", null, "2026-01-01", { firstParty: true }), game("Odd", "Mystery", "2026-01-01", { firstParty: true })];
    expect(build(games).unmatched).toEqual([
      { developer: "", titles: ["No dev"] },
      { developer: "Mystery", titles: ["Odd"] },
    ]);
  });

  // docs/review/data.md, [media] "i giochi di uno studio nascosto o chiuso spariscono senza comparire tra i non abbinati".
  it("lists the games of hidden or closed wiki studios", () => {
    files.studios = [wiki("Nintendo"), wiki("Old Studio", false)];
    files.overrides = { Nintendo: { hidden: true } } satisfies StudiosOverrides;
    const games = [game("DK Challenge", "Nintendo", "2026-01-01", { firstParty: true }), game("B", "Old Studio", "2026-01-01", { firstParty: true })];
    expect(build(games).unmatched.flatMap((u) => u.titles).sort()).toEqual(["B", "DK Challenge"]);
  });

  // docs/review/data.md, [media] "senza cache degli studi la build riesce ma trasforma gli studi first party in partner".
  it("flags a missing or empty studios cache", () => {
    expect(build([]).cacheEmpty).toBe(true);
    files.studios = [wiki("EPD")];
    expect(build([]).cacheEmpty).toBe(false);
  });

  // docs/review/data.md, [bassa] "due studi della wiki con lo stesso nome normalizzato si sovrascrivono".
  it.todo("prefers the shown studio when a closed one claims the same name", () => {
    files.studios = [wiki("EPD"), wiki("Old EPD", false)];
    files.overrides = { "Old EPD": { igdbNames: ["EPD"] } } satisfies StudiosOverrides;
    expect(byName([game("Mario", "EPD", "2026-01-01")], "EPD")?.game?.title).toBe("Mario");
  });
});
