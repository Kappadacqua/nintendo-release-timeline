import { gsap } from "gsap";

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

const SLOTS = ["year", "month", "day"] as const;

/**
 * Date under the playhead: "2026 · September · Sat 26". Each part animates on its
 * own, so scrolling day by day only moves the day. An empty part is hidden.
 */
export class TimelineHeader {
  readonly el: HTMLElement;
  private slots: { wrap: HTMLElement; text: HTMLElement }[];
  private shown = new Map<HTMLElement, string>();
  private swaps = new Map<HTMLElement, gsap.core.Timeline>();

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "timeline-header";
    this.el.setAttribute("aria-live", "polite");
    this.slots = SLOTS.map((name) => {
      const wrap = document.createElement("div");
      wrap.className = `timeline-header__slot timeline-header__${name}`;
      const text = document.createElement("span");
      wrap.append(text);
      this.el.append(wrap);
      return { wrap, text };
    });
  }

  /** `direction` is +1 when moving forward in time, -1 backward. */
  update(parts: [string, string, string], direction: number, animate = true) {
    parts.forEach((part, i) => {
      const { wrap, text } = this.slots[i];
      wrap.hidden = part === "";
      this.set(text, part, direction, animate);
    });
  }

  private set(el: HTMLElement, text: string, direction: number, animate: boolean) {
    if (this.shown.get(el) === text) return;
    this.shown.set(el, text);
    this.swaps.get(el)?.kill();
    if (!animate || reducedMotion.matches) {
      el.textContent = text;
      gsap.set(el, { yPercent: 0, opacity: 1 });
      return;
    }
    const shift = direction >= 0 ? 1 : -1;
    const tl = gsap
      .timeline()
      .to(el, { yPercent: -60 * shift, opacity: 0, duration: 0.12, ease: "power1.in" })
      .call(() => {
        el.textContent = text;
      })
      .fromTo(
        el,
        { yPercent: 60 * shift, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.24, ease: "power3.out" },
      );
    this.swaps.set(el, tl);
  }
}
