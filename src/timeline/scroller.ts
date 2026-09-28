import { TIMELINE } from "./config";
import { restPoint, WheelFling, type WheelAction } from "./wheel-fling";

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

/**
 * Horizontal camera: `current` eases toward `target` for smooth, lightly inertial
 * scrolling. Positions are world x-coordinates of the viewport center.
 */
export class Scroller {
  current = 0;
  target = 0;
  /** Longest distance (px) a drag's inertia may cover (about a month at the current zoom). */
  maxFlingPx = Infinity;
  /** Where every glide must come to rest (e.g. the nearest day). */
  snap: (x: number) => number = (x) => x;
  private min = 0;
  private max = 0;
  private frame = 0;
  private lastTime = 0;
  /** Drag release inertia (px/ms, world direction); 0 = plain easing toward `target`. */
  private velocity = 0;
  /** A long jump (Home, End, minimap, search…) is a timed glide, never longer than `maxGlideMs`. */
  private glide: { from: number; to: number; start: number; duration: number } | null = null;
  /** Wheel fling: `current` slows down toward `target` with `wheelFlingFriction` (lands exactly on it). */
  private coasting = false;

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

  /** Glide to `x`, snapped. Also ends any inertia (new input wins at once). */
  scrollTo(x: number) {
    if (!Number.isFinite(x)) return;
    this.velocity = 0;
    this.coasting = false;
    const to = this.clamp(this.snap(this.clamp(x)));
    // Reduced motion: no glide, just go there.
    if (reducedMotion.matches) return this.jumpTo(to);
    this.target = to;
    // Short steps (wheel, arrows) chase the target; long jumps glide in bounded time.
    const distance = Math.abs(to - this.current);
    this.glide =
      distance > TIMELINE.glideMinPx
        ? { from: this.current, to, start: performance.now(), duration: Math.min(TIMELINE.maxGlideMs, 250 + distance * 0.12) }
        : null;
    this.start();
  }

  /**
   * Come to rest on the snap point nearest to where the view is heading. After a
   * drag, target and current coincide; after a click-to-glide, the glide is kept.
   */
  settle() {
    this.scrollTo(this.target);
  }

  /**
   * After a drag (ITERATION-4 §10): keeps moving at the gesture's speed, slowing down by
   * `flingFriction`, then rests on the nearest snap point. A slow release just snaps.
   */
  fling(velocity: number) {
    if (reducedMotion.matches || Math.abs(velocity) < TIMELINE.flingMinVelocity) return this.settle();
    // With friction f per 60fps frame the glide covers v · 16.7ms / (1 − f): cap v so that
    // even a very fast flick never travels further than maxFlingPx.
    const frameMs = 1000 / 60;
    const maxVelocity = (this.maxFlingPx * (1 - TIMELINE.flingFriction)) / frameMs;
    this.velocity = Math.sign(velocity) * Math.min(Math.abs(velocity), maxVelocity);
    this.glide = null;
    this.target = this.current;
    this.start();
  }

  /**
   * Wheel fling: coast to `x` (already snapped: a day or a release), slowing down with
   * `wheelFlingFriction` all the way, so it lands softly exactly there.
   */
  coast(x: number) {
    if (!Number.isFinite(x)) return;
    this.velocity = 0;
    this.glide = null;
    this.target = this.clamp(x);
    this.coasting = true;
    this.start();
  }

  /** Direction of the wheel fling in progress (+1 / -1), 0 if none or only its slow landing is left. */
  get coastDirection() {
    if (!this.coasting) return 0;
    const remaining = this.target - this.current;
    const speed = (Math.abs(remaining) * -Math.log(TIMELINE.wheelFlingFriction)) / (1000 / 60);
    return speed < TIMELINE.flingStopVelocity ? 0 : Math.sign(remaining);
  }

  /** Inertia in progress? (a click during it stops it instead of selecting). */
  get gliding() {
    return this.velocity !== 0 || this.coastDirection !== 0;
  }

  /** Stops inertia where it is and rests on the nearest snap point (a wheel fling's slow landing is left to end). */
  halt() {
    if (!this.velocity && !this.coastDirection) return;
    this.velocity = 0;
    this.coasting = false;
    this.scrollTo(this.current);
  }

  get bounds() {
    return { min: this.min, max: this.max };
  }

  /** Move instantly (no easing), e.g. while dragging or on first render. */
  jumpTo(x: number) {
    this.velocity = 0;
    this.coasting = false;
    this.glide = null;
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

  /** Stops any glide in progress (timeline being destroyed). */
  dispose() {
    this.stop();
  }

  private stop() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private tick = (now: number) => {
    const dt = Math.min(64, now - this.lastTime);
    this.lastTime = now;
    if (this.glide) {
      const g = this.glide;
      const t = Math.min(1, (now - g.start) / g.duration);
      // Ease in-out (cubic): leaves smoothly, lands softly.
      const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      this.current = g.from + (g.to - g.from) * e;
      if (t >= 1) {
        this.current = g.to;
        this.glide = null;
        this.frame = 0;
      } else {
        this.frame = requestAnimationFrame(this.tick);
      }
      this.onChange(this.current);
      return;
    }
    if (this.velocity) {
      // Inertia: free movement with friction; the bounds stop it dead (no bounce).
      const next = this.clamp(this.current + this.velocity * dt);
      const hitEdge = next !== this.current + this.velocity * dt;
      this.current = this.target = next;
      this.velocity *= Math.pow(TIMELINE.flingFriction, dt / (1000 / 60));
      this.onChange(this.current);
      if (hitEdge || Math.abs(this.velocity) < TIMELINE.flingStopVelocity) {
        this.frame = 0;
        this.scrollTo(this.current);
      } else {
        this.frame = requestAnimationFrame(this.tick);
      }
      return;
    }
    // Frame-rate independent exponential easing (a wheel fling: the remaining distance
    // shrinks like the speed of a drag's inertia, so it slows down the same way).
    const keep = this.coasting ? TIMELINE.wheelFlingFriction : 1 - TIMELINE.smoothing;
    const k = 1 - Math.pow(keep, dt / (1000 / 60));
    this.current += (this.target - this.current) * k;
    if (Math.abs(this.target - this.current) < 0.25) {
      this.current = this.target;
      this.coasting = false;
      this.frame = 0;
    } else {
      this.frame = requestAnimationFrame(this.tick);
    }
    this.onChange(this.current);
  };
}

/**
 * Mouse-wheel notches in a wheel event, or 0 for trackpad-like input (accumulated).
 * - line / page mode: one notch per event (lines per notch depend on OS and settings);
 * - pixel mode: an event of at least `wheelNotchPx` is a notch; one the browser merged
 *   from several notches (while the page was busy) is worth one per `wheelNotchUnitPx`.
 */
function wheelNotches(e: WheelEvent, delta: number) {
  if (e.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) return 1;
  const size = Math.abs(delta);
  if (size < TIMELINE.wheelNotchPx) return 0;
  return Math.max(1, Math.floor(size / TIMELINE.wheelNotchUnitPx));
}

/** `?debug=wheel`: log every wheel event and what it did, to diagnose a specific mouse. */
const debugWheel = new URLSearchParams(location.search).get("debug") === "wheel";

/** Wires mouse wheel / trackpad, drag and keyboard input to a Scroller. */
export function bindScrollInput(
  el: HTMLElement,
  scroller: Scroller,
  opts: {
    dayPx: number;
    /** Days in one unit of the zoom level (1, 7, about 30): a wheel fling moves in these units. */
    unitDays: number;
    /** World x of the releases shown (active filters): a wheel fling may land on them. */
    magnets: () => readonly number[];
    /** A wheel fling starts or speeds up. */
    onWheelFling: () => void;
    /** Move by whole days (wheel notch, trackpad, arrows). */
    onDayStep: (days: number) => void;
    onToday: () => void;
    onHome: () => void;
    onEnd: () => void;
    /** Esc. */
    onEscape: () => void;
    /** A press turned into a drag. */
    onDragStart: () => void;
    /** Shift + arrow moves this many units (days, weeks or months). */
    largeStep: number;
    /** Ctrl + wheel, "+" / "−": +1 zooms in (toward Day), -1 zooms out. */
    onZoom: (dir: 1 | -1) => void;
    /** "[" / "]", Shift + wheel: to the first day of the previous / next month(s). */
    onMonthStep: (months: number) => void;
    /** Page Down / Page Up: jump to the next / previous game. */
    onGameStep: (direction: 1 | -1) => void;
    /** After any keyboard navigation (lets focus follow the centered game). */
    onKeyNavigate: () => void;
  },
) {
  // Wheel: one mouse notch = one day, added to the destination (the glide chases it).
  // When the page is busy, browsers merge several notches into one event with the
  // deltas summed, so an event is worth as many days as notches it contains.
  // Trackpads send many small deltas, which add up to `trackpadDayPx` per day.
  // A longer spin shifts up to 3 or 7 days per notch plus inertia (wheel-fling.ts); trackpads keep the plain behavior.
  const unitPx = opts.dayPx * opts.unitDays;
  const maxPx = TIMELINE.wheelFlingMaxDays * opts.dayPx;
  const wheelFling = new WheelFling();
  /** Where the current spin started, and where it was last sent to land. */
  let spinFrom = 0;
  let spinLanding = 0;
  const spinWheel = (action: Extract<WheelAction, { kind: "move" }>, step: (units: number) => void) => {
    const dir = Math.sign(action.moved || action.units);
    if (action.start) spinFrom = spinLanding = scroller.target;
    // Gear 1 with nothing coasting, or reduced motion: plain steps, snapped.
    if (reducedMotion.matches || (action.rest === action.moved && scroller.coastDirection !== dir)) {
      if (action.units) step(action.units);
      spinLanding = scroller.target;
      return;
    }
    if (!action.units && action.rest === action.moved) return;
    opts.onWheelFling();
    const { min, max } = scroller.bounds;
    const notched = spinFrom + action.moved * unitPx;
    const limit = spinFrom + dir * maxPx;
    // Never behind the notches or an earlier landing of this spin, never past the limit.
    const [near, far] = dir > 0 ? [Math.max(notched, spinLanding), limit] : [Math.min(notched, spinLanding), limit];
    const lo = Math.max(min, Math.min(near, far));
    const hi = Math.min(max, Math.max(near, far));
    spinLanding =
      action.rest === action.moved
        ? restPoint(near, { lo, hi, snap: scroller.snap, magnets: [], magnetPx: 0 })
        : restPoint(spinFrom + action.rest * unitPx, {
            lo,
            hi,
            snap: scroller.snap,
            magnets: opts.magnets(),
            magnetPx: TIMELINE.wheelMagnetUnits * unitPx,
          });
    scroller.coast(spinLanding);
  };
  let wheelAcc = 0;
  let zoomAcc = 0;
  let lastZoom = 0;
  el.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!delta) return;
      // Ctrl + wheel (also a trackpad pinch): zoom level (ITERATION-4 §6), not the page zoom.
      if (e.ctrlKey) {
        if (Math.sign(delta) !== Math.sign(zoomAcc)) zoomAcc = 0;
        zoomAcc += delta;
        const notch = wheelNotches(e, delta) > 0 || Math.abs(zoomAcc) >= TIMELINE.zoomPinchPx;
        if (notch && e.timeStamp - lastZoom > TIMELINE.zoomCooldownMs) {
          lastZoom = e.timeStamp;
          zoomAcc = 0;
          opts.onZoom(delta < 0 ? 1 : -1);
        }
        return;
      }
      const notches = wheelNotches(e, delta);
      if (debugWheel) {
        console.log("[wheel]", { deltaX: e.deltaX, deltaY: e.deltaY, deltaMode: e.deltaMode, notches, accumulated: wheelAcc });
      }
      // Shift + wheel: a month per notch (ITERATION-4 §8); trackpads need a longer swipe for it.
      const step = e.shiftKey ? opts.onMonthStep : opts.onDayStep;
      const unit = e.shiftKey ? TIMELINE.trackpadMonthPx : TIMELINE.trackpadDayPx;
      if (notches && e.shiftKey) {
        wheelAcc = 0;
        step(Math.sign(delta) * notches);
        return;
      }
      if (notches) {
        wheelAcc = 0;
        const action = wheelFling.notch(e.timeStamp, delta > 0 ? 1 : -1, notches, {
          flying: scroller.coastDirection,
          reduced: reducedMotion.matches,
          maxUnits: Math.max(1, Math.round(TIMELINE.wheelFlingMaxDays / opts.unitDays)),
        });
        if (debugWheel) console.log("[wheel]", action);
        if (action.kind === "brake") scroller.halt();
        else spinWheel(action, step);
        return;
      }
      wheelFling.trackpad(e.timeStamp);
      if (Math.sign(delta) !== Math.sign(wheelAcc)) wheelAcc = 0;
      wheelAcc += delta;
      const steps = Math.trunc(wheelAcc / unit);
      if (steps) {
        wheelAcc -= steps * unit;
        step(steps);
      }
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
    // A press during inertia stops it, and does not count as a click on a card.
    suppressClick = scroller.gliding;
    scroller.halt();
    wheelFling.reset();
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
      opts.onDragStart();
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
    // Inertia if the pointer was still moving at release; otherwise just rest on the nearest day.
    scroller.fling(e.timeStamp - lastT < 80 ? velocity : 0);
  };
  el.addEventListener("pointerup", endPress);
  el.addEventListener("pointercancel", endPress);

  el.addEventListener(
    "click",
    (e) => {
      if (!suppressClick) return;
      suppressClick = false;
      e.preventDefault();
      e.stopPropagation();
    },
    true,
  );
  // Links and images would otherwise start a native drag-and-drop.
  el.addEventListener("dragstart", (e) => e.preventDefault());

  const onKey = (e: KeyboardEvent) => {
    // AltGr (Ctrl+Alt on Windows) types "[" and "]" on many layouts, e.g. Italian.
    if ((e.ctrlKey || e.metaKey || e.altKey) && !e.getModifierState("AltGraph")) return;
    const t = e.target instanceof HTMLElement ? e.target : null;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.closest("dialog"))) return;
    // Any key stops a wheel fling where it is (arrows then step from there).
    scroller.halt();
    wheelFling.reset();

    const days = e.shiftKey ? opts.largeStep : 1;
    if (e.key === "ArrowRight") opts.onDayStep(days);
    else if (e.key === "ArrowLeft") opts.onDayStep(-days);
    else if (e.key === "Escape") opts.onEscape();
    else if (e.key === "t" || e.key === "T") opts.onToday();
    else if (e.key === "Home") opts.onHome();
    else if (e.key === "End") opts.onEnd();
    else if (e.key === "+" || e.key === "=") opts.onZoom(1);
    else if (e.key === "-" || e.key === "_" || e.key === "−") opts.onZoom(-1);
    else if (e.key === "]") opts.onMonthStep(1);
    else if (e.key === "[") opts.onMonthStep(-1);
    else if (e.key === "PageDown") opts.onGameStep(1);
    else if (e.key === "PageUp") opts.onGameStep(-1);
    else return;
    e.preventDefault();
    opts.onKeyNavigate();
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}
