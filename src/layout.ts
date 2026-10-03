/**
 * Mobile layout (SPEC "Mobile"): which way the timeline runs and when the header folds into
 * a menu. The same media queries are written in the CSS (keep them in step: layout.test.ts
 * checks it), so the page looks right before any script runs.
 */

/** Vertical timeline (past at the top, future at the bottom): phones in portrait and landscape, narrow windows. */
export const VERTICAL_QUERY = "(max-width: 820px), (max-height: 500px)";

/** Header folded into a menu: below the desktop width (1280 px) or on a short (landscape phone) screen. */
export const COMPACT_HEADER_QUERY = "(max-width: 1279px), (max-height: 500px)";

/** The same decision as VERTICAL_QUERY, for a viewport size (tests, and where no matchMedia exists). */
export function isVerticalSize(width: number, height: number) {
  return width <= 820 || height <= 500;
}

export function isVerticalLayout() {
  return typeof matchMedia === "function" ? matchMedia(VERTICAL_QUERY).matches : isVerticalSize(innerWidth, innerHeight);
}

/** Calls `onChange(vertical)` whenever the layout flips (rotation, resize); returns the cleanup. */
export function watchLayout(onChange: (vertical: boolean) => void) {
  const query = matchMedia(VERTICAL_QUERY);
  const handler = () => onChange(query.matches);
  query.addEventListener("change", handler);
  return () => query.removeEventListener("change", handler);
}

/** A coarse pointer (finger) is the main input: bigger targets, taps instead of hover. */
export function isTouchPrimary() {
  return typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
}
