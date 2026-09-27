import { gsap } from "gsap";
import type { Timeline } from "./timeline/timeline";
import { ZOOM, ZOOM_LEVELS, type ZoomLevel } from "./timeline/zoom";

/** Day / Week / Month indicator at the top right of the timeline (ITERATION-4 §6); click to change. */
export class ZoomControl {
  private readonly el: HTMLElement;

  constructor(host: HTMLElement, level: ZoomLevel, onPick: (level: ZoomLevel) => void) {
    this.el = document.createElement("div");
    this.el.className = "zoom-control";
    this.el.setAttribute("role", "group");
    this.el.setAttribute("aria-label", "Zoom level");
    this.el.title = "Zoom: Ctrl + wheel, or + / −";
    for (const l of ZOOM_LEVELS) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.level = l;
      b.textContent = ZOOM[l].label;
      b.addEventListener("click", () => onPick(l));
      this.el.append(b);
    }
    host.append(this.el);
    this.set(level);
  }

  set(level: ZoomLevel) {
    for (const b of this.el.querySelectorAll<HTMLButtonElement>("button")) {
      b.setAttribute("aria-pressed", String(b.dataset.level === level));
    }
  }
}

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

/**
 * Zoom transition: the old view grows (zooming in) or shrinks (zooming out) around the
 * playhead as it fades, while the new one comes from the other way; then the old is removed.
 */
export function zoomTransition(from: Timeline, to: Timeline, zoomingIn: boolean) {
  from.destroy(true);
  const old = from.element;
  if (reducedMotion.matches) return old.remove();
  const big = 1.6;
  const small = 0.62;
  const origin = (t: Timeline) => `50% ${t.lineCenterY}px`;
  gsap.to(from.stage, {
    scale: zoomingIn ? big : small,
    opacity: 0,
    transformOrigin: origin(from),
    duration: 0.45,
    ease: "power2.in",
    onComplete: () => old.remove(),
  });
  gsap.from(to.stage, {
    scale: zoomingIn ? small : big,
    opacity: 0,
    transformOrigin: origin(to),
    duration: 0.45,
    ease: "power2.out",
    clearProps: "transform,opacity",
  });
}
