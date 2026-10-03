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

describe("assignLanes on one side (vertical timeline, SPEC Mobile)", () => {
  const row = { width: 80, height: 0 };
  const vstack = { stepX: 30, stepY: 10 };

  it("keeps every row on the given side", () => {
    const lanes = assignLanes([0, 32, 64, 400].map((x) => ({ ...row, x })), 8, 1.25, vstack, ["below"]);
    expect(lanes.every((l) => l.side === "below")).toBe(true);
  });

  it("slides a close row down its column before stacking it", () => {
    const [a, b] = assignLanes([{ ...row, x: 0 }, { ...row, x: 32 }], 8, 1.25, vstack, ["below"]);
    expect(a).toMatchObject({ level: 0, shift: 0 });
    expect(b.level).toBe(0);
    expect(b.shift).toBe(80 + 8 - 32);
  });

  it("stacks a row that would slide too far", () => {
    const lanes = assignLanes([0, 0, 0].map((x) => ({ ...row, x })), 8, 1.25, vstack, ["below"]);
    expect(lanes.map((l) => l.level)).toEqual([0, 0, 1]);
  });
});
