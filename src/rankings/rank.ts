import { parseDay } from "../timeline/dates";
import type { Game, Score, ScoreSource } from "../types";

// Ranking logic of the Rankings page (SPEC §12), without DOM so it can be tested.

export type SortKey = ScoreSource | "critics" | "users";

export const SORTS: { key: SortKey; label: string; sources: ScoreSource[] }[] = [
  { key: "opencritic", label: "OpenCritic", sources: ["opencritic"] },
  { key: "metacritic", label: "Metacritic", sources: ["metacritic"] },
  { key: "metacriticUser", label: "Metacritic User", sources: ["metacriticUser"] },
  { key: "backloggd", label: "Backloggd", sources: ["backloggd"] },
  { key: "critics", label: "Critics average", sources: ["opencritic", "metacritic"] },
  { key: "users", label: "Users average", sources: ["metacriticUser", "backloggd"] },
];

export interface Settings {
  sort: SortKey;
  minReviews: number;
}

/** Released on or before `today` (epoch day). */
export function isReleased(game: Game, today: number) {
  return game.firstReleaseDate != null && parseDay(game.firstReleaseDate) <= today;
}

export function scoreOf(game: Game, source: ScoreSource): Score | null {
  const { critic, user } = game.scores;
  switch (source) {
    case "opencritic":
      return critic.opencritic;
    case "metacritic":
      return critic.metacritic;
    case "metacriticUser":
      return user.metacritic;
    case "backloggd":
      return user.backloggd;
  }
}

export type Ranked = {
  game: Game;
  /** Normalized 0–100 value used for sorting. */
  value: number;
  /** Reviews behind the value, for ties. */
  count: number;
  /** Sources that passed the threshold and make up the value. */
  used: ScoreSource[];
};

/** Released games with a score from the chosen sort, best first. */
export function rank(games: Game[], today: number, { sort, minReviews }: Settings) {
  const { sources } = SORTS.find((s) => s.key === sort)!;
  const released = games.filter((g) => isReleased(g, today));
  const ranked: Ranked[] = [];
  for (const game of released) {
    // Each source counts only if it reaches the threshold on its own.
    const used = sources.filter((src) => {
      const score = scoreOf(game, src);
      return score != null && (score.count ?? 0) >= minReviews;
    });
    if (used.length === 0) continue;
    const scores = used.map((src) => scoreOf(game, src)!);
    ranked.push({
      game,
      value: scores.reduce((sum, s) => sum + s.normalized, 0) / scores.length,
      count: scores.reduce((sum, s) => sum + (s.count ?? 0), 0),
      used,
    });
  }
  // Ties: more reviews first, then title.
  ranked.sort((a, b) => b.value - a.value || b.count - a.count || a.game.title.localeCompare(b.game.title));
  return { ranked, hidden: released.length - ranked.length };
}
