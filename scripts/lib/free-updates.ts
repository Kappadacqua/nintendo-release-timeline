import type { Game } from "../../src/types";
import { emptyLinks, readJson, writeJson } from "./cache";
import { PATHS } from "./env";
import type { IgdbGame } from "./igdb";
import { baseTitleOfEdition } from "./links";
import { sameTitle, toGame } from "./transform";

/**
 * Switch games with a free Switch 2 update (data/free-updates.json, curated by hand from
 * Nintendo's page). They become `free-update` entries placed on the update date: no scores,
 * one worldwide date, the original game's cover, summary and links.
 */

export interface FreeUpdateEntry {
  title: string;
  /** Original Switch release. */
  game_release_date: string;
  switch_2_update_date: string;
  type: "free_update";
  /** US store page, used when no Italian (EU) page is known. */
  store_url?: string;
  /** IGDB id of the original game, when the title search finds the wrong one or none. */
  igdbId?: number;
}

export interface FreeUpdatesFile {
  source: string;
  description: string;
  count: number;
  games: FreeUpdateEntry[];
}

/** data/cache/free-updates.json, written by data:fetch-free-updates. */
export interface FreeUpdatesCache {
  fetchedAt: string;
  /** The original game on IGDB, by title in data/free-updates.json (null = not found). */
  matches: Record<string, number | null>;
  games: IgdbGame[];
  wikipediaByTitle: Record<string, string>;
  nintendoWikiByTitle: Record<string, string>;
  /** Wikidata eShop ids per IGDB slug (same meaning as in links.json). */
  eshopEuBySlug: Record<string, string>;
  eshopUsBySlug: Record<string, string>;
  /** Titles matched only by the original release year, not by title: to check by hand. */
  approximate: string[];
}

export const emptyFreeUpdatesCache = (): FreeUpdatesCache => ({
  fetchedAt: new Date(0).toISOString(),
  matches: {},
  games: [],
  wikipediaByTitle: {},
  nintendoWikiByTitle: {},
  eshopEuBySlug: {},
  eshopUsBySlug: {},
  approximate: [],
});

export function loadFreeUpdates(): FreeUpdateEntry[] {
  return readJson<FreeUpdatesFile | null>(PATHS.freeUpdates, null)?.games ?? [];
}

/**
 * data/free-updates-seen.json: the build day each free update first appeared in the file,
 * null for the first import (already known, so never "new" in What's new). The free updates
 * are not in the data:fetch snapshots, so this is what dates their "new" change.
 */
export function freeUpdatesFirstSeen(today: string): Record<string, string | null> {
  const saved = readJson<Record<string, string | null> | null>(PATHS.freeUpdatesSeen, null);
  const seen = { ...saved };
  for (const { title } of loadFreeUpdates()) {
    const id = freeUpdateId(title);
    if (!(id in seen)) seen[id] = saved ? today : null;
  }
  writeJson(PATHS.freeUpdatesSeen, seen);
  return seen;
}

/** Stable id from the title, so a new IGDB match does not change it. */
export const freeUpdateId = (title: string) =>
  `free-update:${title.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

/** Best IGDB entry for a title: exact title, main game over ports / editions, closest first release. */
export function pickIgdbGame(entry: FreeUpdateEntry, games: IgdbGame[]): IgdbGame | undefined {
  const target = Date.parse(entry.game_release_date) / 1000;
  const rank = (g: IgdbGame) => [
    g.game_type?.type?.toLowerCase().replace(/[^a-z]/g, "") === "maingame" ? 0 : 1,
    g.version_parent ? 1 : 0,
    g.first_release_date ? Math.abs(g.first_release_date - target) : Infinity,
  ];
  const cmp = (a: number[], b: number[]) => a.map((x, i) => x - b[i]).find((d) => d !== 0) ?? 0;
  return games.filter((g) => sameTitle(g.name, entry.title)).sort((a, b) => cmp(rank(a), rank(b)))[0];
}

/** Same game already in the dataset (a Switch 2 Edition counts as its base game). */
function duplicateOf(title: string, games: Game[]) {
  return games.find((g) => sameTitle(g.title, title) || sameTitle(baseTitleOfEdition(g.title) ?? "", title));
}

export interface FreeUpdatesResult {
  games: Game[];
  /** Left out: the same game already has a card. */
  duplicates: { title: string; of: string }[];
  /** No IGDB match: no cover, summary or developer. */
  notOnIgdb: string[];
  /** Matched on IGDB by release year only (possibly another game). */
  approximate: string[];
}

/**
 * `free-update` entries for games.json, from the cache only. `existing` is the rest of the
 * dataset (duplicates are skipped); `euStore` turns an IGDB game into its Italian store page.
 */
export function freeUpdateGames(
  existing: Game[],
  euStore: (g: IgdbGame, links: ReturnType<typeof emptyLinks>) => string | undefined,
): FreeUpdatesResult {
  const cache = { ...emptyFreeUpdatesCache(), ...readJson<Partial<FreeUpdatesCache>>(PATHS.freeUpdatesCache, {}) };
  const igdb = new Map(cache.games.map((g) => [g.id, g]));
  const links = { ...emptyLinks(), eshopEuBySlug: cache.eshopEuBySlug, eshopUsBySlug: cache.eshopUsBySlug };
  const result: FreeUpdatesResult = { games: [], duplicates: [], notOnIgdb: [], approximate: [] };

  for (const entry of loadFreeUpdates()) {
    const dup = duplicateOf(entry.title, existing);
    if (dup) {
      result.duplicates.push({ title: entry.title, of: dup.title });
      continue;
    }
    const date = entry.switch_2_update_date;
    const id = cache.matches[entry.title];
    const g = id != null ? igdb.get(id) : undefined;
    if (!g) result.notOnIgdb.push(entry.title);
    else if (cache.approximate.includes(entry.title)) result.approximate.push(entry.title);
    const base: Game = g
      ? toGame(g, { releaseDates: {}, firstReleaseDate: null, fullyUnknown: false })
      : {
          id: "",
          kind: "game",
          title: entry.title,
          coverUrl: "covers/placeholder.svg",
          summary: null,
          backgroundUrl: null,
          developer: null,
          genres: [],
          releaseDates: {},
          firstReleaseDate: null,
          exclusivity: null,
          firstParty: true,
          alsoOnSwitch1: true,
          scores: { critic: { opencritic: null, metacritic: null }, user: { metacritic: null, backloggd: null } },
          links: {},
        };
    const store = (g && euStore(g, links)) || entry.store_url;
    result.games.push({
      ...base,
      id: freeUpdateId(entry.title),
      kind: "free-update",
      title: entry.title,
      // One worldwide date: the same day in every region.
      releaseDates: { JP: date, EU: date, NA: date },
      firstReleaseDate: date,
      originalReleaseYear: Number(entry.game_release_date.slice(0, 4)),
      firstParty: true,
      alsoOnSwitch1: true,
      links: {
        ...(cache.wikipediaByTitle[entry.title] ? { wikipedia: cache.wikipediaByTitle[entry.title] } : {}),
        ...(cache.nintendoWikiByTitle[entry.title] ? { nintendoWiki: cache.nintendoWikiByTitle[entry.title] } : {}),
        ...(store ? { nintendoStore: store } : {}),
      },
    });
  }
  return result;
}
