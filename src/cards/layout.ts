import type { Game } from "../types";

export type Side = "above" | "below";

export interface Lane {
  side: Side;
  /** 0 = closest to the line; higher levels stack further out, behind. */
  level: number;
  /** Horizontal shift of the card (px, ≥ 0) away from its release date. */
  shift: number;
  /** How far out (px) the card sits beyond the level-0 position: 0 at level 0. */
  extra: number;
}

/**
 * Estimated card heights in px (unscaled), per kind and style: like the widths, the
 * collision layout needs them before any DOM exists. Tall-ish values from card.css:
 * a free update adds "Originally released" and the "Worldwide" line, a released game
 * the scores, an upcoming one the "Upcoming" bar.
 */
export const CARD_HEIGHT = {
  compact: { game: 124, freeUpdate: 156 },
  full: { released: 272, upcoming: 200, freeUpdate: 162, freeUpdateUpcoming: 204 },
  /** Closed same-day group: covers and label, the same in both styles. */
  group: 152,
} as const;

export function cardHeight(game: Game, compact: boolean, upcoming: boolean) {
  const free = game.kind === "free-update";
  if (compact) return free ? CARD_HEIGHT.compact.freeUpdate : CARD_HEIGHT.compact.game;
  if (free) return upcoming ? CARD_HEIGHT.full.freeUpdateUpcoming : CARD_HEIGHT.full.freeUpdate;
  return upcoming ? CARD_HEIGHT.full.upcoming : CARD_HEIGHT.full.released;
}

export interface Stack {
  /** Each extra level moves at least this far out… */
  stepY: number;
  /** …and this far sideways. */
  stepX: number;
}

/**
 * Greedy lane assignment over items sorted by x. Each item takes, at the lowest
 * level possible, the side (above/below) needing the smallest rightward shift,
 * provided it stays within `maxShift × width`. So nearby games alternate
 * above/below, slide sideways a bit when needed, and stack only as a last resort.
 *
 * A stacked card sits `stepY` further out than the cards it overlaps in front of it,
 * measured on its outer edge: with cards of equal height that is `level × stepY`; behind
 * a taller card (a free update, a full card with scores) it moves out further, so it
 * always shows the same strip instead of being covered.
 */
export function assignLanes(
  items: { x: number; width: number; height: number }[],
  gap: number,
  maxShift: number,
  stack: Stack,
  /** Sides to use: both, or one (vertical timeline: a single column of cards, SPEC "Mobile"). */
  sides: readonly Side[] = ["above", "below"],
): Lane[] {
  const laneEnds = new Map<string, number>();
  const placed: { side: Side; level: number; left: number; right: number; extra: number; height: number }[] = [];
  return items.map(({ x, width, height }) => {
    const idealLeft = x - width / 2;
    for (let level = 0; ; level++) {
      let best: Omit<Lane, "extra"> | null = null;
      for (const side of sides) {
        const end = laneEnds.get(`${side}:${level}`) ?? -Infinity;
        const shift = Math.max(0, end + gap - idealLeft);
        if (shift <= maxShift * width && (!best || shift < best.shift)) best = { side, level, shift };
      }
      if (best) {
        laneEnds.set(`${best.side}:${level}`, idealLeft + best.shift + width);
        const left = idealLeft + best.shift + level * stack.stepX;
        const right = left + width;
        let extra = level * stack.stepY;
        for (const p of placed) {
          if (p.side !== best.side || p.level >= level || p.right <= left || right <= p.left) continue;
          extra = Math.max(extra, p.extra + stack.stepY, p.extra + p.height + stack.stepY - height);
        }
        placed.push({ side: best.side, level, left, right, extra, height });
        return { ...best, extra };
      }
    }
  });
}
