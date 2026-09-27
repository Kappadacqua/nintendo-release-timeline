import type { Game, Score } from "./types";

// Minimal fixtures for the *.test.ts files (never imported by the site).

/** A game with no scores, links or dates: only what a test sets. */
export function makeGame(fields: Partial<Game> & { title: string }): Game {
  return {
    id: `test:${fields.title}`,
    kind: "game",
    coverUrl: "covers/placeholder.svg",
    summary: null,
    backgroundUrl: null,
    developer: null,
    genres: [],
    releaseDates: {},
    firstReleaseDate: null,
    exclusivity: null,
    firstParty: false,
    alsoOnSwitch1: false,
    scores: { critic: { opencritic: null, metacritic: null }, user: { metacritic: null, backloggd: null } },
    links: {},
    ...fields,
  };
}

/** A 0–100 score (the scale doesn't matter to the logic under test). */
export const score = (normalized: number, count: number | null): Score => ({ value: normalized, scale: 100, normalized, count });
