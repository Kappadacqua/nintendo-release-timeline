import { afterEach, describe, expect, it, vi } from "vitest";
import { applyFilters, countLabel, isDefault, loadFilters } from "./filters";
import { makeGame } from "./test-utils";

describe("Exclusives only", () => {
  const exclusive = makeGame({ title: "A", exclusivity: "exclusive", onOtherConsoles: false });
  const phones = makeGame({ title: "B", exclusivity: null, onOtherConsoles: false });
  const multi = makeGame({ title: "C", exclusivity: null, onOtherConsoles: true });
  const on = { ...loadFilters(), exclusivesOnly: true };

  it("hides games on other consoles or PC, keeps phone ones", () => {
    expect(applyFilters([exclusive, phones, multi], on).map((g) => g.title)).toEqual(["A", "B"]);
  });

  it("counts as an active filter", () => {
    expect(isDefault(loadFilters())).toBe(true);
    expect(isDefault(on)).toBe(false);
  });
});

describe("countLabel", () => {
  it("reads 'N games' only without active filters", () => {
    expect(countLabel(84, 84, false)).toBe("84 games");
    expect(countLabel(84, 84, true)).toBe("84 of 84");
    expect(countLabel(70, 84, true)).toBe("70 of 84");
  });
});

describe("loadFilters", () => {
  afterEach(() => vi.unstubAllGlobals());
  const stored = (value: string) => vi.stubGlobal("localStorage", { getItem: () => value });

  it("keeps saved booleans", () => {
    stored(JSON.stringify({ dlc: false, exclusivesOnly: true }));
    expect(loadFilters()).toMatchObject({ dlc: false, exclusivesOnly: true, thirdParty: true });
  });

  it("ignores values that are not booleans", () => {
    stored(JSON.stringify({ dlc: "false", exclusivesOnly: "true", thirdParty: 0 }));
    expect(isDefault(loadFilters())).toBe(true);
  });

  it("falls back to the defaults on null or invalid JSON", () => {
    stored("null");
    expect(isDefault(loadFilters())).toBe(true);
    stored("{");
    expect(isDefault(loadFilters())).toBe(true);
  });
});
