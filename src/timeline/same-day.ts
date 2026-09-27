import type { Game } from "../types";

// Same-day releases (ITERATION-4 §4) without DOM: keyboard order and the dot's colors.

const isUpdate = (game: Game) => game.kind === "free-update";

/** Whether the items on the day at `x` mix games and free updates (split group dot). */
export function mixesKinds(items: readonly { x: number; game: Game }[], x: number) {
  const day = items.filter((i) => i.x === x);
  return day.some((i) => isUpdate(i.game)) && day.some((i) => !isUpdate(i.game));
}

/**
 * Keyboard order: by x, then games before free updates, then by title. A group's games
 * stay together (keyed by its first title, in its own order), so Page Down from the last
 * game of a group lands on the first game of the next group on the same day.
 */
export function orderStops<T extends { x: number; game: Game; group?: { games?: Game[] } }>(stops: readonly T[]): T[] {
  const block = (s: T) => s.group?.games?.[0] ?? s.game;
  return [...stops].sort(
    (a, b) =>
      a.x - b.x ||
      Number(isUpdate(block(a))) - Number(isUpdate(block(b))) ||
      block(a).title.localeCompare(block(b).title),
  );
}
