import { describe, expect, it } from "vitest";
import { makeGame } from "../../src/test-utils";
import { applyOverride } from "./overrides";
import { validateGameOverride } from "./overrides-schema";

describe("developer override", () => {
  it("replaces the IGDB developer", () => {
    const game = makeGame({ title: "DK Challenge", developer: "Nintendo" });
    expect(applyOverride(game, { developer: "Nintendo EPD" }).developer).toBe("Nintendo EPD");
  });

  it("keeps the IGDB developer when the override has none", () => {
    const game = makeGame({ title: "DK Challenge", developer: "Nintendo" });
    expect(applyOverride(game, { alsoOnSwitch1: true }).developer).toBe("Nintendo");
  });

  it("is accepted by the schema only as a non-empty name", () => {
    expect(validateGameOverride("igdb:405439", { developer: "Nintendo EPD" })).toEqual([]);
    expect(validateGameOverride("igdb:405439", { developer: "" })).toHaveLength(1);
    expect(validateGameOverride("igdb:405439", { developer: null })).toHaveLength(1);
  });
});
