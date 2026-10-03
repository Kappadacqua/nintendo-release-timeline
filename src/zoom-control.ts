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
 * Zoom transition: the old view goes at once (never two timelines on screen); the new one
 * comes in around the playhead, from a little smaller (zooming in) or larger (zooming out).
 */
export function zoomTransition(from: Timeline, to: Timeline, zoomingIn: boolean) {
  from.destroy();
  if (reducedMotion.matches) return;
  gsap.from(to.stage, {
    scale: zoomingIn ? 0.85 : 1.18,
    opacity: 0,
    transformOrigin: to.zoomOrigin,
    duration: 0.3,
    ease: "power2.out",
    clearProps: "transform,opacity",
  });
}
