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

describe("metacritic override", () => {
  const read = makeGame({ title: "Donkey Kong Bananza" });
  read.scores.critic.metacritic = { value: 91, scale: 100, normalized: 91, count: 147 };
  read.scores.user.metacritic = { value: 8.9, scale: 10, normalized: 89, count: 3268 };

  it("replaces only the fields written by hand", () => {
    const out = applyOverride(read, { metacritic: { critic: 90, criticCount: 150 } });
    expect(out.scores.critic.metacritic).toEqual({ value: 90, scale: 100, normalized: 90, count: 150 });
    expect(out.scores.user.metacritic?.value).toBe(8.9);
  });

  it("keeps the values read from Metacritic when the override fields are empty", () => {
    const out = applyOverride(read, { metacritic: { critic: null, user: null } as never });
    expect(out.scores.critic.metacritic?.value).toBe(91);
    expect(out.scores.user.metacritic?.value).toBe(8.9);
  });
});

describe("absent override", () => {
  it("accepts a confirmed absence per source", () => {
    expect(validateGameOverride("igdb:405468", { absent: { metacritic: { status: "none", reason: "HTTP 410", checkedAt: "2026-10-01" } } })).toEqual([]);
  });

  it("rejects unknown sources, statuses and dates", () => {
    expect(validateGameOverride("igdb:1", { absent: { ign: { status: "none" } } })).toHaveLength(1);
    expect(validateGameOverride("igdb:1", { absent: { metacritic: { status: "missing" } } })).toHaveLength(1);
    expect(validateGameOverride("igdb:1", { absent: { metacritic: { status: "none", checkedAt: "1 Oct" } } })).toHaveLength(1);
  });
});
