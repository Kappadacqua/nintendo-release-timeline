import { describe, expect, it } from "vitest";
import { counterText } from "./presentation";

describe("presentation counter (reduced motion)", () => {
  it("counts only games with a precise date", () => {
    expect(counterText([true, true, true, false], 1)).toBe("2 / 3");
    expect(counterText([true, false, true, true], 3)).toBe("3 / 3");
  });

  it("is empty without a dated selection", () => {
    expect(counterText([true, true], -1)).toBe("");
    expect(counterText([true, false], 1)).toBe("");
  });
});
