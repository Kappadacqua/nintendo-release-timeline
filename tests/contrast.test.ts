import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// WCAG AA for text on coloured fills and tints (docs/tasks/design.md, task 4).
const css = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");

/** The declarations of the block opened by `head` (first match), as name → raw value. */
function block(head: string): Map<string, string> {
  const start = css.indexOf(head);
  if (start < 0) throw new Error(`No block ${head}`);
  const open = css.indexOf("{", start + head.length - 1);
  const close = css.indexOf("}", open);
  const out = new Map<string, string>();
  for (const [, name, value] of css.slice(open + 1, close).matchAll(/(--[\w-]+):\s*([^;]+);/g)) out.set(name, value.trim());
  return out;
}

const light = block("\n:root {");
const darkMedia = block(':root:not([data-theme="light"]) {');
const darkAttr = block(':root[data-theme="dark"] {');

/** A token's hex value in a theme, following var() references and falling back to the light block. */
function hex(theme: Map<string, string>, name: string): string {
  const raw = theme.get(name) ?? light.get(name);
  if (!raw) throw new Error(`Missing ${name}`);
  const ref = raw.match(/^var\((--[\w-]+)\)$/);
  if (ref) return hex(theme, ref[1]);
  if (!/^#[0-9a-f]{6}$/i.test(raw) && raw !== "#fff") throw new Error(`${name} is not a hex colour: ${raw}`);
  return raw === "#fff" ? "#ffffff" : raw;
}

type Rgb = [number, number, number];
const rgb = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
const luminance = (c: Rgb) => {
  const [r, g, b] = c.map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: Rgb, b: Rgb) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
/** `color-mix(in srgb, top p, transparent)` over `under`. */
const tint = (top: Rgb, p: number, under: Rgb): Rgb => top.map((v, i) => v * p + under[i] * (1 - p)) as Rgb;

const NEW_TOKENS = ["--accent-fill", "--dlc-fill", "--news-fill", "--free-update-fill", "--accent-text", "--news-text-soft", "--delayed-text"];

describe("text contrast on fills (tokens.css)", () => {
  it("the two dark blocks agree", () => {
    for (const name of NEW_TOKENS) expect(hex(darkAttr, name), name).toBe(hex(darkMedia, name));
  });

  // Veil over the selected game's background (docs/tasks/polish.md, task 2).
  it("the two dark blocks agree on --backdrop-veil", () => {
    expect(darkMedia.get("--backdrop-veil")).toBeDefined();
    expect(darkAttr.get("--backdrop-veil")).toBe(darkMedia.get("--backdrop-veil"));
  });

  for (const [theme, tokens] of [
    ["light", light],
    ["dark", darkAttr],
  ] as const) {
    const t = (name: string) => rgb(hex(tokens, name));

    it.each(["--accent-fill", "--dlc-fill", "--news-fill", "--free-update-fill"])(`${theme}: --on-accent on %s ≥ 4.5`, (fill) => {
      expect(contrast(t("--on-accent"), t(fill))).toBeGreaterThanOrEqual(4.5);
    });

    // Card buttons on hover: filter: brightness(0.9) on the fill.
    it(`${theme}: --on-accent on --accent-fill at brightness 0.9 ≥ 4.5`, () => {
      const hovered = t("--accent-fill").map((v) => v * 0.9) as Rgb;
      expect(contrast(t("--on-accent"), hovered)).toBeGreaterThanOrEqual(4.5);
    });

    // Tinted badges sit on a card or panel (--card).
    it.each([
      ["--accent-text", "--accent", 0.16],
      ["--delayed-text", "--delayed", 0.22],
      ["--news-text-soft", "--news", 0.14],
    ] as const)(`${theme}: %s on %s at %d ≥ 4.5`, (text, base, p) => {
      expect(contrast(t(text), tint(t(base), p, t("--card")))).toBeGreaterThanOrEqual(4.5);
    });
  }
});
