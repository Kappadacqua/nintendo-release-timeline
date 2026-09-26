import type { Game } from "./types";

/**
 * Date history rules (ITERATION-3 §3), shared by data:build, the site and the
 * "what's new" list. A delay is a precise date that becomes later, or a precise
 * date that goes back to vague / TBA. Vague → precise is not a delay.
 */
export interface DatePoint {
  /** Day of the observation (snapshot date). */
  date: string;
  firstReleaseDate: string | null;
}

export interface Delay {
  /** When the delay was observed. */
  on: string;
  /** The precise date it had before. */
  from: string;
  /** The new precise date, or null if it went back to vague / TBA. */
  to: string | null;
}

/** Every delay, oldest first. */
export function delaysOf(history: DatePoint[] | undefined): Delay[] {
  const out: Delay[] = [];
  const points = history ?? [];
  for (let i = 1; i < points.length; i++) {
    const before = points[i - 1].firstReleaseDate;
    const now = points[i].firstReleaseDate;
    // Only a precise date can be delayed (vague → precise is good news, not a delay).
    if (before && (now === null || now > before)) out.push({ on: points[i].date, from: before, to: now });
  }
  return out;
}

/**
 * The delay worth showing on the card: the latest one, while the game is still
 * unreleased and its date has not come back to (or before) the original one.
 */
export function currentDelay(game: Pick<Game, "firstReleaseDate" | "dateHistory">, today: string): Delay | null {
  const delays = delaysOf(game.dateHistory);
  const last = delays.at(-1);
  if (!last) return null;
  if (game.firstReleaseDate && game.firstReleaseDate <= today) return null; // out now
  if (game.firstReleaseDate && game.firstReleaseDate <= last.from) return null; // moved back
  return last;
}
