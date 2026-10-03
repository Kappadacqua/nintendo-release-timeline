import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COMPACT_HEADER_QUERY, isVerticalSize, VERTICAL_QUERY } from "./layout";

const css = (name: string) => readFileSync(new URL(`./styles/${name}`, import.meta.url), "utf8");

describe("isVerticalSize (SPEC Mobile)", () => {
  it("runs the timeline vertically on phones, in portrait and landscape", () => {
    expect(isVerticalSize(360, 640)).toBe(true);
    expect(isVerticalSize(390, 844)).toBe(true);
    expect(isVerticalSize(430, 932)).toBe(true);
    expect(isVerticalSize(844, 390)).toBe(true);
  });

  it("vertical on a tablet in portrait, horizontal in landscape and on desktop", () => {
    expect(isVerticalSize(768, 1024)).toBe(true);
    expect(isVerticalSize(820, 1180)).toBe(true);
    expect(isVerticalSize(1024, 768)).toBe(false);
    expect(isVerticalSize(1440, 900)).toBe(false);
    expect(isVerticalSize(1920, 1080)).toBe(false);
  });

  it("matches the media query written in the CSS", () => {
    expect(VERTICAL_QUERY).toBe("(max-width: 820px), (max-height: 500px)");
  });
});

describe("media queries in step with src/layout.ts", () => {
  it("folds the header (mobile.css, base.css) at the COMPACT_HEADER_QUERY breakpoint", () => {
    const at = `@media ${COMPACT_HEADER_QUERY}`;
    expect(css("mobile.css")).toContain(at);
    expect(css("base.css")).toContain(at);
  });
});
