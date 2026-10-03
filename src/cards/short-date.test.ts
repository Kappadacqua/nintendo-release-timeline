import { describe, expect, it } from "vitest";
import { fullYearDate, shortDate } from "./short-date";

describe("shortDate", () => {
  it("leaves out the year when it matches refYear", () => {
    expect(shortDate("2026-05-28", 2026)).toBe("May 28");
  });

  it("abbreviates another year with a typographic apostrophe", () => {
    expect(shortDate("2026-05-28", 2025)).toBe("May 28 ’26");
  });

  it("always shows the year with refYear 0", () => {
    expect(shortDate("2025-12-25", 0)).toBe("Dec 25 ’25");
  });
});

describe("fullYearDate", () => {
  it("writes the year in full", () => {
    expect(fullYearDate("2025-06-05")).toBe("Jun 5, 2025");
  });
});
