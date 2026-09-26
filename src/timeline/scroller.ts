import { TIMELINE } from "./config";

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

/**
 * Horizontal camera: `current` eases toward `target` for smooth, lightly inertial
 * scrolling. Positions are world x-coordinates of the viewport center.
 */
export class Scroller {
  current = 0;
  target = 0;
  private min = 0;
  private max = 0;
  private frame = 0;
  private lastTime = 0;

  constructor(private onChange: (x: number) => void) {}

  setBounds(min: number, max: number) {
    this.min = min;
    this.max = max;
    this.target = this.clamp(this.target);
    this.current = this.clamp(this.current);
    this.onChange(this.current);
  }

  /** Move smoothly by `dx` pixels. */
  nudge(dx: number) {
    this.scrollTo(this.target + dx);
  }

  scrollTo(x: number) {
    // Reduced motion: no glide, just go there.
    if (reducedMotion.matches) return this.jumpTo(x);
    this.target = this.clamp(x);
    this.start();
  }

  /** Move instantly (no easing), e.g. while dragging or on first render. */
  jumpTo(x: number) {
    this.target = this.current = this.clamp(x);
    this.stop();
    this.onChange(this.current);
  }

  private clamp(x: number) {
    return Math.min(this.max, Math.max(this.min, x));
  }

  private start() {
    if (this.frame) return;
    this.lastTime = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  private stop() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private tick = (now: number) => {
    const dt = Math.min(64, now - this.lastTime);
    this.lastTime = now;
    // Frame-rate independent exponential easing.
    const k = 1 - Math.pow(1 - TIMELINE.smoothing, dt / (1000 / 60));
    this.current += (this.target - this.current) * k;
    if (Math.abs(this.target - this.current) < 0.25) {
      this.current = this.target;
      this.frame = 0;
    } else {
      this.frame = requestAnimationFrame(this.tick);
    }
    this.onChange(this.current);
  };
}

/** Wires mouse wheel / trackpad, drag and keyboard input to a Scroller. */
export function bindScrollInput(
  el: HTMLElement,
  scroller: Scroller,
  opts: {
    dayPx: number;
    onToday: () => void;
    onHome: () => void;
    onEnd: () => void;
    /** Page Down / Page Up: jump to the next / previous game. */
    onGameStep: (direction: 1 | -1) => void;
    /** After any keyboard navigation (lets focus follow the centered game). */
    onKeyNavigate: () => void;
  },
) {
  el.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      // Vertical wheel scrolls horizontally; trackpads send deltaX directly.
      let delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= 16;
      else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) delta *= el.clientWidth;
      scroller.nudge(delta);
    },
    { passive: false },
  );

  // A press becomes a drag only after a few pixels, so links inside cards stay clickable.
  const DRAG_THRESHOLD = 5;
  let pressed = false;
  let dragging = false;
  let suppressClick = false;
  let startX = 0;
  let lastX = 0;
  let lastT = 0;
  let velocity = 0; // px/ms, in world direction

  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    pressed = true;
    dragging = false;
    startX = lastX = e.clientX;
    lastT = e.timeStamp;
    velocity = 0;
  });

  el.addEventListener("pointermove", (e) => {
    if (!pressed) return;
    if (!dragging) {
      if (Math.abs(e.clientX - startX) < DRAG_THRESHOLD) return;
      dragging = true;
      el.setPointerCapture(e.pointerId);
      el.classList.add("is-dragging");
    }
    const dx = e.clientX - lastX;
    const dt = Math.max(1, e.timeStamp - lastT);
    velocity = 0.8 * (-dx / dt) + 0.2 * velocity;
    lastX = e.clientX;
    lastT = e.timeStamp;
    scroller.jumpTo(scroller.current - dx);
  });

  const endPress = (e: PointerEvent) => {
    pressed = false;
    if (!dragging) return;
    dragging = false;
    el.classList.remove("is-dragging");
    // The click that follows a drag must not follow a link.
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 0);
    // No fling if the pointer paused before release.
    if (e.timeStamp - lastT < 80) scroller.scrollTo(scroller.current + velocity * TIMELINE.flingMs);
  };
  el.addEventListener("pointerup", endPress);
  el.addEventListener("pointercancel", endPress);

  el.addEventListener(
    "click",
    (e) => {
      if (!suppressClick) return;
      e.preventDefault();
      e.stopPropagation();
    },
    true,
  );
  // Links and images would otherwise start a native drag-and-drop.
  el.addEventListener("dragstart", (e) => e.preventDefault());

  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target instanceof HTMLElement ? e.target : null;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.closest("dialog"))) return;

    const step = (e.shiftKey ? TIMELINE.keyStepDaysLarge : TIMELINE.keyStepDays) * opts.dayPx;
    if (e.key === "ArrowRight") scroller.nudge(step);
    else if (e.key === "ArrowLeft") scroller.nudge(-step);
    else if (e.key === "t" || e.key === "T") opts.onToday();
    else if (e.key === "Home") opts.onHome();
    else if (e.key === "End") opts.onEnd();
    else if (e.key === "PageDown") opts.onGameStep(1);
    else if (e.key === "PageUp") opts.onGameStep(-1);
    else return;
    e.preventDefault();
    opts.onKeyNavigate();
  });
}
