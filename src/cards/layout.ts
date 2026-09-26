export type Side = "above" | "below";

export interface Lane {
  side: Side;
  /** 0 = closest to the line; higher levels stack further out, behind. */
  level: number;
  /** Horizontal shift of the card (px, ≥ 0) away from its release date. */
  shift: number;
}

/**
 * Greedy lane assignment over items sorted by x. Each item takes, at the lowest
 * level possible, the side (above/below) needing the smallest rightward shift,
 * provided it stays within `maxShift × width`. So nearby games alternate
 * above/below, slide sideways a bit when needed, and stack only as a last resort.
 */
export function assignLanes(
  items: { x: number; width: number }[],
  gap: number,
  maxShift: number,
): Lane[] {
  const laneEnds = new Map<string, number>();
  return items.map(({ x, width }) => {
    const idealLeft = x - width / 2;
    for (let level = 0; ; level++) {
      let best: Lane | null = null;
      for (const side of ["above", "below"] as const) {
        const end = laneEnds.get(`${side}:${level}`) ?? -Infinity;
        const shift = Math.max(0, end + gap - idealLeft);
        if (shift <= maxShift * width && (!best || shift < best.shift)) best = { side, level, shift };
      }
      if (best) {
        laneEnds.set(`${best.side}:${level}`, idealLeft + best.shift + width);
        return best;
      }
    }
  });
}
