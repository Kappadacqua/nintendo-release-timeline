import { describe, expect, it } from "vitest";
import { pinchSteps } from "./pinch";

describe("pinchSteps (SPEC Mobile)", () => {
  it("is 0 until the fingers moved by the step factor", () => {
    expect(pinchSteps(200, 200)).toBe(0);
    expect(pinchSteps(200, 260, 1.35)).toBe(0);
    expect(pinchSteps(200, 160, 1.35)).toBe(0);
  });

  it("zooms in when the fingers move apart, out when they come together", () => {
    expect(pinchSteps(200, 280, 1.35)).toBe(1);
    expect(pinchSteps(200, 140, 1.35)).toBe(-1);
    expect(pinchSteps(100, 400, 1.35)).toBe(4);
  });

  it("ignores a missing distance", () => {
    expect(pinchSteps(0, 100)).toBe(0);
    expect(pinchSteps(100, 0)).toBe(0);
  });
});
