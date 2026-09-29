import { describe, expect, it } from "vitest";
import { resolveView } from "./view";

describe("resolveView", () => {
  it("seasonal background on by default", () => {
    expect(resolveView({}, false)).toEqual({
      view: { cardStyle: "full", groupSameDay: true, seasonalBackground: true },
      seasonalChosen: false,
    });
  });

  it("off by default with reduced motion", () => {
    expect(resolveView({}, true).view.seasonalBackground).toBe(false);
  });

  it("a saved choice wins over the default, with or without reduced motion", () => {
    expect(resolveView({ seasonalBackground: true }, true)).toMatchObject({ view: { seasonalBackground: true }, seasonalChosen: true });
    expect(resolveView({ seasonalBackground: false }, false)).toMatchObject({ view: { seasonalBackground: false }, seasonalChosen: true });
  });

  it("settings saved before the switch existed keep following reduced motion", () => {
    const old = { cardStyle: "compact", groupSameDay: false };
    expect(resolveView(old, false).view).toEqual({ cardStyle: "compact", groupSameDay: false, seasonalBackground: true });
    expect(resolveView(old, true).view.seasonalBackground).toBe(false);
  });

  it("invalid values fall back to the defaults", () => {
    const { view, seasonalChosen } = resolveView({ cardStyle: "big", groupSameDay: "yes", seasonalBackground: 1 }, false);
    expect(view).toEqual({ cardStyle: "full", groupSameDay: true, seasonalBackground: true });
    expect(seasonalChosen).toBe(false);
    expect(resolveView(null, false).view.cardStyle).toBe("full");
  });
});
