import { describe, expect, it } from "vitest";
import { shortDeveloper } from "./developer";

describe("shortDeveloper", () => {
  it("keeps short names", () => {
    expect(shortDeveloper("Monolith Soft")).toBe("Monolith Soft");
  });

  it("drops divisions and corporate words from long names", () => {
    expect(shortDeveloper("Nintendo EPD Production Group No. 9")).toBe("Nintendo EPD");
    expect(shortDeveloper("Konami Digital Entertainment")).toBe("Konami");
    expect(shortDeveloper("Nintendo Software Technology")).toBe("NST");
  });

  it("drops a note in brackets instead of cutting it mid-word", () => {
    expect(shortDeveloper("Nintendo (unknown studio)")).toBe("Nintendo");
  });

  it("cuts what is still too long with an ellipsis", () => {
    expect(shortDeveloper("An Extremely Long Developer Name")).toBe("An Extremely Long D…");
  });
});
