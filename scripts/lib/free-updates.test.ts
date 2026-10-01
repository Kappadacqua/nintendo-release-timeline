import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeGame } from "../../src/test-utils";
import { PATHS } from "./env";
import { type FreeUpdateEntry, freeUpdateGames, freeUpdateId } from "./free-updates";

// data/free-updates.json comes from the test; the IGDB cache is empty unless a test sets matches.
const file = vi.hoisted(() => ({ entries: [] as unknown[], matches: {} as Record<string, number> }));
vi.mock("./cache", async (original) => ({
  ...(await original<typeof import("./cache")>()),
  readJson: (path: string, fallback: unknown) =>
    path === PATHS.freeUpdates ? { games: file.entries } : path === PATHS.freeUpdatesCache ? { matches: file.matches } : fallback,
}));

const entry = (title: string): FreeUpdateEntry => ({
  title,
  game_release_date: "2020-03-20",
  switch_2_update_date: "2025-06-05",
  type: "free_update",
});
const run = (titles: string[], existing = [makeGame({ title: "Unrelated" })]) => {
  file.entries = titles.map(entry);
  return freeUpdateGames(existing, () => undefined);
};

beforeEach(() => {
  file.entries = [];
  file.matches = {};
});

describe("freeUpdateGames: duplicates", () => {
  it("skips a game already in the dataset, ignoring case and punctuation", () => {
    const r = run(["ARMS", "Super Mario Odyssey"], [makeGame({ title: "Arms" })]);
    expect(r.duplicates).toEqual([{ title: "ARMS", of: "Arms" }]);
    expect(r.games.map((g) => g.title)).toEqual(["Super Mario Odyssey"]);
  });

  it("counts a Switch 2 Edition as its base game", () => {
    const edition = makeGame({ title: "Animal Crossing: New Horizons – Nintendo Switch 2 Edition", kind: "switch2-edition" });
    expect(run(["Animal Crossing: New Horizons"], [edition]).duplicates).toEqual([
      { title: "Animal Crossing: New Horizons", of: edition.title },
    ]);
  });

  it("does not report an entry that is the card's own game (same IGDB id) as a merge", () => {
    file.matches = { "Pokémon Champions": 333568 };
    const r = run(["Pokémon Champions"], [makeGame({ id: "igdb:333568", title: "Pokémon Champions" })]);
    expect(r.duplicates).toEqual([]);
    expect(r.games).toEqual([]); // still no second card
  });

  it("keeps games with a similar but different title", () => {
    expect(run(["Mario Kart 8 Deluxe"], [makeGame({ title: "Mario Kart World" })]).duplicates).toEqual([]);
  });

  // docs/review/data.md, [bassa] "i doppioni si riconoscono solo dal titolo": DLC should be ignored.
  it.todo("is not hidden by a DLC with the same title", () => {
    expect(run(["Splatoon 3"], [makeGame({ title: "Splatoon 3", kind: "dlc" })]).duplicates).toEqual([]);
  });
});

describe("freeUpdateGames: entries", () => {
  it("builds a free-update card on the update date, in every region", () => {
    const [g] = run(["Pokémon Scarlet & Violet"]).games;
    expect(g).toMatchObject({
      id: "free-update:pokemon-scarlet-violet",
      kind: "free-update",
      firstReleaseDate: "2025-06-05",
      releaseDates: { JP: "2025-06-05", EU: "2025-06-05", NA: "2025-06-05" },
      originalReleaseYear: 2020,
      firstParty: true,
    });
  });

  it("reports titles without an IGDB match", () => {
    expect(run(["Unknown Game"]).notOnIgdb).toEqual(["Unknown Game"]);
  });
});

describe("freeUpdateId", () => {
  it("is a slug of the title, stable across accents and punctuation", () => {
    expect(freeUpdateId("Pokémon Legends: Arceus")).toBe("free-update:pokemon-legends-arceus");
    expect(freeUpdateId("  Kirby & the Forgotten Land! ")).toBe("free-update:kirby-the-forgotten-land");
  });
});

describe("freeUpdateGames: invalid entries", () => {
  it("leaves out entries without a title or with a malformed date, with the reason", () => {
    file.entries = [
      entry("Good"),
      { ...entry("No date"), game_release_date: undefined },
      { ...entry("Short date"), switch_2_update_date: "2025-6-5" },
      { ...entry("Not a day"), switch_2_update_date: "2025-02-30" },
      { ...entry(""), title: "  " },
    ];
    const r = freeUpdateGames([], () => undefined);
    expect(r.games.map((g) => g.title)).toEqual(["Good"]);
    expect(r.invalid).toEqual([
      'No date — game_release_date "" is not YYYY-MM-DD',
      'Short date — switch_2_update_date "2025-6-5" is not YYYY-MM-DD',
      'Not a day — switch_2_update_date "2025-02-30" is not YYYY-MM-DD',
      "entry 5 — missing title",
    ]);
  });
});
