import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeGame } from "../../src/test-utils";
import { PATHS } from "./env";
import { type FreeUpdateEntry, freeUpdateGames, freeUpdateId } from "./free-updates";

// data/free-updates.json comes from the test; the IGDB cache is empty (no match for any title).
const file = vi.hoisted(() => ({ entries: [] as unknown[] }));
vi.mock("./cache", async (original) => ({
  ...(await original<typeof import("./cache")>()),
  readJson: (path: string, fallback: unknown) => (path === PATHS.freeUpdates ? { games: file.entries } : fallback),
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
