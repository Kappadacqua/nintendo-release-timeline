import { describe, expect, it } from "vitest";
import { makeGame } from "../test-utils";
import { assignLanes, CARD_HEIGHT, cardHeight } from "./layout";
import { COMPACT_CARD_WIDTH } from "./card";

const stack = { stepX: 22, stepY: 56 };
const w = COMPACT_CARD_WIDTH.game;

describe("cardHeight", () => {
  it("makes compact free updates taller than compact games (Originally released, Worldwide)", () => {
    const update = cardHeight(makeGame({ title: "Pikmin 3 Deluxe", kind: "free-update" }), true, false);
    const game = cardHeight(makeGame({ title: "Orbitals" }), true, false);
    expect(update).toBeGreaterThan(game);
  });

  it("uses the scores for released full cards, the Upcoming bar otherwise", () => {
    const g = makeGame({ title: "Orbitals" });
    expect(cardHeight(g, false, false)).toBe(CARD_HEIGHT.full.released);
    expect(cardHeight(g, false, true)).toBe(CARD_HEIGHT.full.upcoming);
  });
});

describe("assignLanes", () => {
  it("stacks equal cards one step out per level", () => {
    const items = [0, 32, 96].map((x) => ({ x, width: w, height: 124 }));
    const lanes = assignLanes(items, 16, 0.6, stack);
    expect(lanes[2]).toMatchObject({ side: "above", level: 1, extra: 56 });
  });

  it("moves a card stacked behind a taller free update out, so the same strip shows", () => {
    // Pikmin 3 Deluxe (Aug 31), Mario Kart 8 Deluxe (Sep 1), Orbitals (Sep 3) in Compact at 32 px/day.
    const update = CARD_HEIGHT.compact.freeUpdate;
    const items = [
      { x: 0, width: w, height: update },
      { x: 32, width: w, height: update },
      { x: 96, width: w, height: CARD_HEIGHT.compact.game },
    ];
    const lanes = assignLanes(items, 16, 0.6, stack);
    expect(lanes[2].level).toBe(1);
    // Outer edge one step beyond the update's: never covered by it.
    expect(lanes[2].extra + CARD_HEIGHT.compact.game).toBe(update + stack.stepY);
  });

  it("does not move a stacked card for a taller card it does not overlap", () => {
    const items = [
      { x: 0, width: w, height: 300 },
      { x: 400, width: w, height: 124 },
      { x: 420, width: w, height: 124 },
      { x: 440, width: w, height: 124 },
    ];
    const lanes = assignLanes(items, 16, 0.6, stack);
    expect(lanes[3]).toMatchObject({ level: 1, extra: 56 });
  });
});
