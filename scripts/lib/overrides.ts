import { existsSync, readFileSync } from "node:fs";
import type { Game, Score } from "../../src/types";

/** One entry of data/overrides.json (SPEC §4), keyed by "igdb:<id>". */
export interface Override {
  /** Free-form reminder of which game this is; ignored by the scripts. */
  _title?: string;
  /** true: force into the timeline (third parties, DLC/editions without OpenCritic page). false: hide. */
  include?: boolean;
  exclusivity?: Game["exclusivity"];
  alsoOnSwitch1?: boolean;
  /** Forces the OpenCritic match when the title search gets it wrong. */
  opencriticId?: number;
  metacritic?: { critic?: number; criticCount?: number; user?: number; userCount?: number };
  backloggd?: { rating?: number; count?: number };
  links?: Game["links"];
  /** Fixes single regional dates ("YYYY-MM-DD", or null for TBA) when IGDB is wrong or incomplete. */
  releaseDates?: Game["releaseDates"];
}

/** A game missing from IGDB, written by hand. Scores and links still come from `games["manual:…"]`. */
export interface ManualGame {
  id: `manual:${string}`;
  kind?: Game["kind"];
  title: string;
  baseGameTitle?: string;
  coverUrl?: string;
  developer?: string | null;
  genres?: string[];
  /** Precise dates ("YYYY-MM-DD"); leave out or null for TBA. */
  releaseDates?: Game["releaseDates"];
  /** For the TBA zone; omit `year` when not even the year is known. */
  vagueRelease?: { year?: number; label: string };
  exclusivity?: Game["exclusivity"];
  alsoOnSwitch1?: boolean;
  links?: Game["links"];
}

export interface OverridesFile {
  games: Record<string, Override>;
  /** Wikipedia page title → ids ("igdb:…" or "manual:…") when the automatic match fails. */
  wikipedia: Record<string, string[]>;
  manualGames: ManualGame[];
}

export function loadOverrides(path: string): OverridesFile {
  if (!existsSync(path)) return { games: {}, wikipedia: {}, manualGames: [] };
  const data = JSON.parse(readFileSync(path, "utf8")) as Partial<OverridesFile>;
  return { games: data.games ?? {}, wikipedia: data.wikipedia ?? {}, manualGames: data.manualGames ?? [] };
}

const emptyScores = (): Game["scores"] => ({
  critic: { opencritic: null, metacritic: null },
  user: { metacritic: null, backloggd: null },
});

/** Builds a full Game from a hand-written entry (no year → sorted at the end of the TBA zone). */
export function manualToGame(m: ManualGame): Game {
  const releaseDates: Game["releaseDates"] = { JP: null, EU: null, NA: null, ...m.releaseDates };
  const known = Object.values(releaseDates).filter((d): d is string => !!d).sort();
  const game: Game = {
    id: m.id,
    kind: m.kind ?? "game",
    title: m.title,
    coverUrl: m.coverUrl ?? "/covers/placeholder.svg",
    developer: m.developer ?? null,
    genres: m.genres ?? [],
    releaseDates,
    firstReleaseDate: known[0] ?? null,
    exclusivity: m.exclusivity ?? null,
    alsoOnSwitch1: m.alsoOnSwitch1 ?? false,
    scores: emptyScores(),
    links: m.links ?? {},
  };
  if (m.baseGameTitle) game.baseGameTitle = m.baseGameTitle;
  if (!game.firstReleaseDate && m.vagueRelease?.year) {
    game.vagueRelease = { year: m.vagueRelease.year, label: m.vagueRelease.label };
  }
  return game;
}

const MULTIPLIER = { 5: 20, 10: 10, 100: 1 } as const;

/** SPEC §5: keep the original value, add a 0–100 normalized one. */
export function score(value: number | undefined, scale: Score["scale"], count?: number | null): Score | null {
  if (value === undefined || value === null || !Number.isFinite(value)) return null;
  return {
    value,
    scale,
    normalized: Math.round(Math.min(100, Math.max(0, value * MULTIPLIER[scale]))),
    count: count ?? null,
  };
}

/** Applies manual scores, links and flags on top of a game built from the APIs. */
export function applyOverride(game: Game, o: Override | undefined): Game {
  if (!o) return game;
  const out: Game = { ...game, scores: { critic: { ...game.scores.critic }, user: { ...game.scores.user } } };
  if (o.exclusivity !== undefined) out.exclusivity = o.exclusivity;
  if (o.alsoOnSwitch1 !== undefined) out.alsoOnSwitch1 = o.alsoOnSwitch1;
  if (o.metacritic) {
    out.scores.critic.metacritic = score(o.metacritic.critic, 100, o.metacritic.criticCount);
    out.scores.user.metacritic = score(o.metacritic.user, 10, o.metacritic.userCount);
  }
  if (o.backloggd) out.scores.user.backloggd = score(o.backloggd.rating, 5, o.backloggd.count);
  out.links = { ...game.links, ...o.links };
  if (o.releaseDates) {
    out.releaseDates = { ...game.releaseDates, ...o.releaseDates };
    const known = Object.values(out.releaseDates).filter((d): d is string => !!d).sort();
    out.firstReleaseDate = known[0] ?? null;
    if (out.firstReleaseDate) delete out.vagueRelease;
  }
  return out;
}
