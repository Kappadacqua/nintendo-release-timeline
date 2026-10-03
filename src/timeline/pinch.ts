import { TIMELINE } from "./config";

/**
 * Zoom levels a pinch has asked for since its baseline: +1 per `step` factor the fingers moved
 * apart (zoom in, toward Day), -1 per factor they came together; 0 in between.
 */
export function pinchSteps(baseline: number, distance: number, step = TIMELINE.pinchStep) {
  if (baseline <= 0 || distance <= 0) return 0;
  const ratio = distance / baseline;
  return Math.trunc(Math.log(ratio) / Math.log(step)) || 0;
}

/**
 * Two-finger pinch on the timeline (SPEC "Mobile"): the touch equivalent of Ctrl + wheel. It
 * listens on a container that outlives the timeline (a zoom rebuilds it mid-gesture), one level
 * at a time, at most one per `zoomCooldownMs`. The timeline's own drag ignores multi-touch.
 */
export function bindPinch(host: HTMLElement, onZoom: (dir: 1 | -1) => void) {
  const fingers = new Map<number, { x: number; y: number }>();
  let baseline = 0;
  let last = 0;
  const spread = () => {
    const [a, b] = [...fingers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const down = (e: PointerEvent) => {
    if (e.pointerType !== "touch") return;
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.size === 2) baseline = spread();
  };
  const move = (e: PointerEvent) => {
    if (!fingers.has(e.pointerId)) return;
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.size !== 2 || !baseline) return;
    const distance = spread();
    const steps = pinchSteps(baseline, distance);
    const now = performance.now();
    if (!steps || now - last < TIMELINE.zoomCooldownMs) return;
    last = now;
    // Continue from here: pinching on asks for the next level.
    baseline = distance;
    onZoom(steps > 0 ? 1 : -1);
  };
  const up = (e: PointerEvent) => {
    fingers.delete(e.pointerId);
    if (fingers.size < 2) baseline = 0;
  };
  // Capture: seen even when the timeline (rebuilt by the zoom) captured the pointer.
  host.addEventListener("pointerdown", down, true);
  window.addEventListener("pointermove", move, true);
  window.addEventListener("pointerup", up, true);
  window.addEventListener("pointercancel", up, true);
  return () => {
    host.removeEventListener("pointerdown", down, true);
    window.removeEventListener("pointermove", move, true);
    window.removeEventListener("pointerup", up, true);
    window.removeEventListener("pointercancel", up, true);
  };
}
