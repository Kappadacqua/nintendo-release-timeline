import { describe, expect, it } from "vitest";
import { makeGame } from "../test-utils";
import type { Game } from "../types";
import { mixesKinds, orderStops } from "./same-day";

const game = (title: string) => makeGame({ title });
const update = (title: string) => makeGame({ title, kind: "free-update" });

/** One stop per game of a group, as the timeline builds them. */
function groupStops(x: number, games: Game[]) {
  const group = { games };
  return games.map((g) => ({ x, game: g, group }));
}

describe("orderStops", () => {
  it("keeps each same-day group together, games first", () => {
    const games = groupStops(0, [game("Mario Kart World"), game("Shine Post"), game("Survival Kids")]);
    const updates = groupStops(0, [update("ARMS"), update("Splatoon 3"), update("Super Mario Odyssey")]);
    // Interleaved by title before the fix: Shine Post → Splatoon 3 → Super Mario Odyssey → Survival Kids.
    const titles = orderStops([...updates, ...games]).map((s) => s.game.title);
    expect(titles).toEqual(["Mario Kart World", "Shine Post", "Survival Kids", "ARMS", "Splatoon 3", "Super Mario Odyssey"]);
  });

  it("orders by x first, then single cards by title", () => {
    const stops = [
      { x: 10, game: game("Zelda") },
      { x: 0, game: game("Metroid") },
      { x: 10, game: game("Kirby") },
      { x: 10, game: update("Animal Crossing") },
    ];
    expect(orderStops(stops).map((s) => s.game.title)).toEqual(["Metroid", "Kirby", "Zelda", "Animal Crossing"]);
  });
});

describe("mixesKinds", () => {
  it("is true only on a day with both games and free updates", () => {
    const items = [
      { x: 0, game: game("Mario Kart World") },
      { x: 0, game: update("ARMS") },
      { x: 5, game: game("Donkey Kong Bananza") },
      { x: 9, game: update("Kirby") },
    ];
    expect(mixesKinds(items, 0)).toBe(true);
    expect(mixesKinds(items, 5)).toBe(false);
    expect(mixesKinds(items, 9)).toBe(false);
  });
});
