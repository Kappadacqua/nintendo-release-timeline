import type { Game, Studio, StudioCategory, StudioGame } from "../../src/types";
import { readJson } from "./cache";
import { PATHS } from "./env";
import { type StudiosCache, loadStudiosOverrides } from "./fandom";

/**
 * public/data/studios.json: Nintendo Wiki's active first-party studios, the partners (developers
 * of a game published by Nintendo or The Pokémon Company) and the third-party developers of
 * exclusives, each matched to games.json through the IGDB developer name.
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

/** Nintendo (and its regional branches) or The Pokémon Company, as an IGDB publisher name. */
export const isNintendoPublisher = (name: string) => /^nintendo\b|\bpokemon company\b/.test(normalizeStudio(name));

export interface StudiosResult {
  studios: Studio[];
  /** Developers of first-party games attributed to no studio ("" = no IGDB developer). */
  unmatched: { developer: string; titles: string[] }[];
}

/** What the caller knows from the cached IGDB data. */
export interface StudioGameInfo {
  /** Playable on Switch 2. */
  onSwitch2: (g: Game) => boolean;
  /** Released on Switch 1. */
  onSwitch1: (g: Game) => boolean;
  /** Published by Nintendo or The Pokémon Company. */
  byNintendo: (g: Game) => boolean;
}

/**
 * Games and Switch 2 Editions count; DLC and free updates don't. `today` is the local calendar day
 * ("YYYY-MM-DD"): a game out today is still upcoming, as on the page and the timeline.
 */
export function buildStudios(games: Game[], info: StudioGameInfo, today: string): StudiosResult {
  const cache = readJson<StudiosCache>(PATHS.studiosCache, { fetchedAt: "", source: "", studios: [] });
  const overrides = loadStudiosOverrides();
  const wikiTitles = new Set(cache.studios.map((s) => s.title));

  // Every wiki studio (closed and hidden ones too) claims its names, so their games are "matched"
  // without being shown: e.g. "Nintendo", the parent company, is hidden and attributes to no one.
  const byName = new Map<string, { title: string; url: string; shown: boolean }>();
  for (const s of cache.studios) {
    const o = overrides[s.title] ?? {};
    const shown = (o.active ?? s.active) && !o.hidden;
    for (const name of [s.title, ...(o.igdbNames ?? [])]) byName.set(normalizeStudio(name), { title: s.title, url: s.url, shown });
  }
  // Overrides for names outside the wiki: aliases (and hiding) for partners and third parties.
  const alias = new Map<string, { name: string; hidden: boolean }>();
  for (const [name, o] of Object.entries(overrides)) {
    if (wikiTitles.has(name)) continue;
    for (const n of [name, ...(o.igdbNames ?? [])]) alias.set(normalizeStudio(n), { name, hidden: !!o.hidden });
  }

  const counted = games.filter((g) => g.kind === "game" || g.kind === "switch2-edition");
  const gamesOf = new Map<string, Game[]>();
  const others = new Map<string, { name: string; games: Game[]; hidden: boolean }>();
  const unmatched = new Map<string, string[]>();
  for (const g of counted) {
    if (!g.developer) {
      if (g.firstParty) unmatched.set("", [...(unmatched.get("") ?? []), g.title]);
      continue;
    }
    const studio = byName.get(normalizeStudio(g.developer));
    if (studio) {
      if (studio.shown) gamesOf.set(studio.title, [...(gamesOf.get(studio.title) ?? []), g]);
      continue;
    }
    const a = alias.get(normalizeStudio(g.developer));
    const key = normalizeStudio(a?.name ?? g.developer);
    const o = others.get(key) ?? { name: a?.name ?? g.developer, games: [], hidden: a?.hidden ?? false };
    o.games.push(g);
    others.set(key, o);
  }

  const toStudio = (name: string, url: string | null, category: StudioCategory, list: Game[]): Studio => {
    // Only Switch 2 games are shown; Switch 1 games only give "Latest: … · Switch 1" to studios without one.
    const switch2 = list.filter(info.onSwitch2);
    const hasSwitch2Game = switch2.length > 0;
    const switch1 = hasSwitch2Game ? null : latestGame(list.filter(info.onSwitch1), today);
    return { name, url, category, game: shownGame(switch2, today), hasSwitch2Game, ...(switch1 && { latestSwitch1Game: switch1 }) };
  };
  const rest: Studio[] = [];
  for (const o of others.values()) {
    const category = o.games.some(info.byNintendo) ? "partner" : o.games.some((g) => g.exclusivity !== null) ? "third-party" : null;
    // First-party games whose developer is neither a wiki studio nor a partner.
    if (category !== "partner")
      for (const g of o.games.filter((g) => g.firstParty)) unmatched.set(g.developer!, [...(unmatched.get(g.developer!) ?? []), g.title]);
    if (category && !o.hidden) rest.push(toStudio(o.name, null, category, o.games));
  }
  const studios = [
    ...cache.studios
      .filter((s) => byName.get(normalizeStudio(s.title))?.shown)
      .map((s) => toStudio(s.title, s.url, "first-party", gamesOf.get(s.title) ?? [])),
    ...rest,
  ].sort(byShownGame);

  return { studios, unmatched: [...unmatched].map(([developer, titles]) => ({ developer, titles })) };
}

const dated = (list: Game[]) =>
  list.filter((g) => g.firstReleaseDate).sort((a, b) => a.firstReleaseDate!.localeCompare(b.firstReleaseDate!));

const toStudioGame = (g: Game, today: string): StudioGame => ({
  id: g.id,
  title: g.title,
  coverUrl: g.coverUrl,
  date: g.firstReleaseDate!,
  status: g.firstReleaseDate! >= today ? "upcoming" : "released",
});

/** The next game out (today included) with a precise date, else the latest released one. */
function shownGame(list: Game[], today: string): StudioGame | null {
  const sorted = dated(list);
  const g = sorted.find((g) => g.firstReleaseDate! >= today) ?? sorted.at(-1);
  return g ? toStudioGame(g, today) : null;
}

/** The game with the latest precise date. */
function latestGame(list: Game[], today: string): StudioGame | null {
  const g = dated(list).at(-1);
  return g ? toStudioGame(g, today) : null;
}

/** Upcoming first (soonest first), then released (latest first), then no game (alphabetical). */
function byShownGame(a: Studio, b: Studio) {
  const rank = (s: Studio) => (s.game?.status === "upcoming" ? 0 : s.game ? 1 : 2);
  const ra = rank(a);
  if (ra !== rank(b)) return ra - rank(b);
  if (ra < 2 && a.game!.date !== b.game!.date) return (a.game!.date < b.game!.date ? -1 : 1) * (ra === 0 ? 1 : -1);
  return a.name.localeCompare(b.name);
}
