import { describe, expect, it } from "vitest";
import { minimapOffset, minimapScale } from "./minimap";

describe("minimap density (SPEC Mobile)", () => {
  it("shows the whole timeline while every month gets enough px", () => {
    // 20 months of 100 world px on a 1000 px track: 50 px a month, more than 40.
    expect(minimapScale(1000, 2000, 100, 40)).toBe(0.5);
  });

  it("keeps a month at its minimum once the timeline outgrows the track", () => {
    // 60 months: 16.7 px a month would be too few, so 40 px (0.4 per world px) and the bar scrolls.
    expect(minimapScale(1000, 6000, 100, 40)).toBe(0.4);
  });

  it("centres the view on the bar, stopping at the timeline's ends", () => {
    const k = 0.4; // 2500 world px visible on a 1000 px track
    expect(minimapOffset(3000, 1000, k, 6000)).toBe(1750);
    expect(minimapOffset(200, 1000, k, 6000)).toBe(0);
    expect(minimapOffset(5900, 1000, k, 6000)).toBe(3500);
    // Everything fits: never scrolls.
    expect(minimapOffset(1500, 1000, 0.5, 2000)).toBe(0);
  });
});
