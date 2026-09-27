import type { Game, Studio, StudioGame } from "../../src/types";
import { readJson } from "./cache";
import { type StudiosCache, loadStudiosOverrides, STUDIO_PATHS } from "./fandom";

/**
 * public/data/studios.json: Nintendo Wiki's active first-party studios, plus the third-party
 * developers of exclusives, each matched to games.json through the IGDB developer name.
 */

/** Developer names compared loosely: case, accents, "&", punctuation and company suffixes ignored. */
export function normalizeStudio(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/(?:\s(?:co|ltd|limited|inc|llc|corp|corporation|gmbh|s a|sa|k k|kk))+\s*$/, "")
    .trim();
}

export interface StudiosResult {
  studios: Studio[];
  /** IGDB developers of first-party games that match no wiki studio (neither active nor hidden). */
  unmatched: { developer: string; titles: string[] }[];
}

/**
 * `onSwitch2` tells whether a game is playable on Switch 2 (IGDB platforms, read by the caller).
 * Games and Switch 2 Editions count; DLC and free updates don't.
 */
export function buildStudios(games: Game[], onSwitch2: (g: Game) => boolean, today: string): StudiosResult {
  const cache = readJson<StudiosCache>(STUDIO_PATHS.cache, { fetchedAt: "", source: "", studios: [] });
  const overrides = loadStudiosOverrides();

  // Every wiki studio (closed and hidden ones too) claims its names, so their games are "matched"
  // without being shown: e.g. "Nintendo", the parent company, is hidden and attributes to no one.
  const byName = new Map<string, { title: string; url: string; shown: boolean }>();
  for (const s of cache.studios) {
    const o = overrides[s.title] ?? {};
    const shown = (o.active ?? s.active) && !o.hidden;
    for (const name of [s.title, ...(o.igdbNames ?? [])]) byName.set(normalizeStudio(name), { title: s.title, url: s.url, shown });
  }

  const counted = games.filter((g) => g.kind === "game" || g.kind === "switch2-edition");
  const gamesOf = new Map<string, Game[]>();
  const thirdParty = new Map<string, { name: string; games: Game[]; exclusive: boolean }>();
  const unmatched = new Map<string, string[]>();
  for (const g of counted) {
    if (!g.developer) continue;
    const key = normalizeStudio(g.developer);
    const studio = byName.get(key);
    if (studio) {
      if (studio.shown) gamesOf.set(studio.title, [...(gamesOf.get(studio.title) ?? []), g]);
      continue;
    }
    if (g.firstParty) unmatched.set(g.developer, [...(unmatched.get(g.developer) ?? []), g.title]);
    const t = thirdParty.get(key) ?? { name: g.developer, games: [], exclusive: false };
    t.games.push(g);
    t.exclusive ||= g.exclusivity !== null;
    thirdParty.set(key, t);
  }

  const toStudio = (name: string, url: string | null, firstParty: boolean, list: Game[]): Studio => ({
    name,
    url,
    firstParty,
    game: shownGame(list, today),
    hasSwitch2Game: list.some(onSwitch2),
  });
  const studios = [
    ...cache.studios
      .filter((s) => byName.get(normalizeStudio(s.title))?.shown)
      .map((s) => toStudio(s.title, s.url, true, gamesOf.get(s.title) ?? [])),
    ...[...thirdParty.values()].filter((t) => t.exclusive).map((t) => toStudio(t.name, null, false, t.games)),
  ].sort(byShownGame);

  return { studios, unmatched: [...unmatched].map(([developer, titles]) => ({ developer, titles })) };
}

/** The next game out with a precise date, else the latest released one. */
function shownGame(list: Game[], today: string): StudioGame | null {
  const dated = list.filter((g) => g.firstReleaseDate).sort((a, b) => a.firstReleaseDate!.localeCompare(b.firstReleaseDate!));
  const next = dated.find((g) => g.firstReleaseDate! > today);
  const g = next ?? dated.at(-1);
  if (!g) return null;
  return { id: g.id, title: g.title, coverUrl: g.coverUrl, date: g.firstReleaseDate!, status: next ? "upcoming" : "released" };
}

/** Upcoming first (soonest first), then released (latest first), then no game (alphabetical). */
function byShownGame(a: Studio, b: Studio) {
  const rank = (s: Studio) => (s.game?.status === "upcoming" ? 0 : s.game ? 1 : 2);
  const ra = rank(a);
  if (ra !== rank(b)) return ra - rank(b);
  if (ra < 2 && a.game!.date !== b.game!.date) return (a.game!.date < b.game!.date ? -1 : 1) * (ra === 0 ? 1 : -1);
  return a.name.localeCompare(b.name);
}
