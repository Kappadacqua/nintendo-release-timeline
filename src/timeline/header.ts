import { gsap } from "gsap";

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

/** Sticky readout (big year, month below); animates only the part that changed. */
export class TimelineHeader {
  readonly el: HTMLElement;
  private primary: HTMLElement;
  private secondary: HTMLElement;
  private shown = new Map<HTMLElement, string>();
  private swaps = new Map<HTMLElement, gsap.core.Timeline>();

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "timeline-header";
    this.el.setAttribute("aria-live", "polite");
    this.primary = this.slot("timeline-header__year");
    this.secondary = this.slot("timeline-header__month");
  }

  private slot(className: string) {
    const wrap = document.createElement("div");
    wrap.className = `timeline-header__slot ${className}`;
    const text = document.createElement("span");
    wrap.append(text);
    this.el.append(wrap);
    return text;
  }

  /** `direction` is +1 when moving forward in time, -1 backward. */
  update(primary: string, secondary: string, direction: number, animate = true) {
    this.set(this.primary, primary, direction, animate);
    this.set(this.secondary, secondary, direction, animate);
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
      .to(el, { yPercent: -60 * shift, opacity: 0, duration: 0.14, ease: "power1.in" })
      .call(() => {
        el.textContent = text;
      })
      .fromTo(
        el,
        { yPercent: 60 * shift, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.28, ease: "power3.out" },
      );
    this.swaps.set(el, tl);
  }
}
