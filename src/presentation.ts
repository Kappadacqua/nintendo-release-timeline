import { TIMELINE } from "./timeline/config";
import type { Timeline } from "./timeline/timeline";

const IGNORED_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "AltGraph", "CapsLock"]);

/**
 * Counter shown instead of the bar with reduced motion: the selected game among those
 * with a precise date (the ones the presentation visits), e.g. "3 / 20"; "" without one.
 */
export function counterText(dated: boolean[], selected: number): string {
  if (selected < 0 || !dated[selected]) return "";
  let index = 0;
  let total = 0;
  dated.forEach((d, i) => {
    if (!d) return;
    total++;
    if (i <= selected) index++;
  });
  return `${index} / ${total}`;
}

/**
 * Presentation mode (ITERATION-4 §9): from where the view is, the next game every few
 * seconds, selected as with Page Down. Space pauses; any other input stops it. A thin
 * bar shows the time left (with reduced motion, a still "3 / 20" counter instead); the
 * pointer hides while it is still.
 */
export class Presentation {
  private active = false;
  private paused = false;
  private timer = 0;
  private stepStart = 0;
  /** Time left (ms) on the current game when paused. */
  private remaining = 0;
  private cursorTimer = 0;
  private readonly bar: HTMLElement;
  private readonly toast: HTMLElement;
  private readonly counter: HTMLElement;
  private readonly stepMs = TIMELINE.presentationSeconds * 1000;

  constructor(
    private readonly timeline: () => Timeline,
    private readonly onChange: (active: boolean) => void = () => {},
  ) {
    this.bar = document.createElement("div");
    this.bar.className = "presentation-bar";
    this.bar.hidden = true;
    this.bar.setAttribute("aria-hidden", "true");
    this.bar.innerHTML = `<span></span>`;
    this.counter = document.createElement("div");
    this.counter.className = "presentation-counter";
    this.counter.hidden = true;
    this.toast = document.createElement("div");
    this.toast.className = "presentation-toast";
    this.toast.setAttribute("role", "status");
    document.body.append(this.bar, this.counter, this.toast);
  }

  get isActive() {
    return this.active;
  }

  toggle() {
    if (this.active) this.stop();
    else this.start();
  }

  start() {
    if (this.active) return;
    this.active = true;
    this.paused = false;
    document.body.classList.add("is-presenting");
    // Capture phase: seen before the timeline acts on the same input.
    window.addEventListener("keydown", this.onKey, true);
    window.addEventListener("wheel", this.onInput, { capture: true, passive: true });
    window.addEventListener("pointerdown", this.onInput, true);
    window.addEventListener("pointermove", this.onPointerMove, { passive: true });
    // Touch (SPEC "Mobile"): no keys, a tap anywhere stops it.
    this.say(matchMedia("(pointer: coarse)").matches ? "Presentation · tap anywhere to stop" : "Presentation · Space to pause · any other key stops");
    // From the current position: the selected game stays for a full turn, else the next one now.
    if (!this.timeline().hasSelection) this.timeline().presentNext();
    this.schedule(this.stepMs);
    this.onPointerMove();
    this.onChange(true);
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    clearTimeout(this.timer);
    clearTimeout(this.cursorTimer);
    document.body.classList.remove("is-presenting", "is-cursor-hidden");
    window.removeEventListener("keydown", this.onKey, true);
    window.removeEventListener("wheel", this.onInput, true);
    window.removeEventListener("pointerdown", this.onInput, true);
    window.removeEventListener("pointermove", this.onPointerMove);
    this.bar.hidden = true;
    this.counter.hidden = true;
    // The shown game is let go: an open group folds, its card goes back to compact.
    // (An input that stopped it may select something else right after, e.g. a click.)
    this.timeline().clearSelection();
    this.say("Presentation stopped");
    this.onChange(false);
  }

  private schedule(ms: number) {
    clearTimeout(this.timer);
    this.stepStart = performance.now() - (this.stepMs - ms);
    this.timer = window.setTimeout(() => {
      this.timeline().presentNext();
      this.schedule(this.stepMs);
    }, ms);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const { dated, selected } = this.timeline().presentationStops;
      this.counter.textContent = counterText(dated, selected);
      this.counter.hidden = !this.counter.textContent;
      this.bar.hidden = true;
      return;
    }
    this.counter.hidden = true;
    // The bar restarts its fill from where this step is.
    const fill = this.bar.firstElementChild as HTMLElement;
    this.bar.hidden = false;
    this.bar.classList.remove("is-paused");
    fill.style.animation = "none";
    void fill.offsetWidth;
    fill.style.animation = `presentation-fill ${this.stepMs}ms linear ${ms - this.stepMs}ms forwards`;
  }

  private togglePause() {
    this.paused = !this.paused;
    if (this.paused) {
      clearTimeout(this.timer);
      this.remaining = Math.max(0, this.stepMs - (performance.now() - this.stepStart));
      this.bar.classList.add("is-paused");
      this.say("Paused · Space to resume");
    } else {
      this.say("Resumed");
      this.schedule(this.remaining);
    }
  }

  private onKey = (e: KeyboardEvent) => {
    if (IGNORED_KEYS.has(e.key)) return;
    if (e.key === " ") {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.togglePause();
      return;
    }
    // "P" toggles it (main.ts); every other key stops it and does its usual job.
    if (e.key === "p" || e.key === "P") return;
    this.stop();
  };

  private onInput = () => this.stop();

  /** The pointer shows while it moves and hides after a moment of stillness. */
  private onPointerMove = () => {
    document.body.classList.remove("is-cursor-hidden");
    clearTimeout(this.cursorTimer);
    this.cursorTimer = window.setTimeout(() => document.body.classList.add("is-cursor-hidden"), TIMELINE.presentationCursorMs);
  };

  private say(text: string) {
    this.toast.textContent = text;
    this.toast.classList.remove("is-shown");
    void this.toast.offsetWidth;
    this.toast.classList.add("is-shown");
  }
}
