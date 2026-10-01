import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { IgdbGame } from "./igdb";
import type { WikiGame } from "./wikipedia";

/**
 * Raw API answers saved by data:fetch and read by data:build (ITERATION-3 §1).
 * data:build never touches the network: everything it needs is in these files.
 */

/** IGDB: every candidate game, plus the base games of DLC / editions (for links). */
export interface IgdbCache {
  fetchedAt: string;
  /** Games published by Nintendo / The Pokémon Company (any era). */
  firstPartyIds: number[];
  games: IgdbGame[];
}

/** Wikipedia "Switch 2-only" category and the IGDB game each page was matched to. */
export interface WikipediaCache {
  fetchedAt: string;
  pages: WikiGame[];
  /** Page title → IGDB id (null = no automatic match; overrides.wikipedia can decide). */
  matches: Record<string, number | null>;
}

/** Reference links found so far; each run adds / refreshes what it looked up. */
export interface LinksCache {
  fetchedAt: string;
  wikipediaBySlug: Record<string, string>;
  wikipediaByTitle: Record<string, string>;
  nintendoWikiByTitle: Record<string, string>;
  /** Wikidata eShop ids per IGDB slug: P12418 (Europe) and P8084 (US store slug). */
  eshopEuBySlug: Record<string, string>;
  eshopUsBySlug: Record<string, string>;
  /** Wikidata OpenCritic id per IGDB slug (P2864). */
  opencriticBySlug: Record<string, string>;
}

/** What data:fetch could not do (errors, quotas), merged into data/fetch-report.json by data:build. */
export interface FetchStatus {
  fetchedAt: string;
  opencritic: {
    enabled: boolean;
    searchesUsed: number;
    requestsUsed: number;
    budgetExhausted: boolean;
    stoppedBecause: string | null;
    errors: string[];
    catalogSize: number;
    /** Games never looked up because the budget ran out: first in line next run. */
    queued?: number;
  };
  /** Metacritic pages read by data:fetch / data:fetch-metacritic (absent before the first run). */
  metacritic?: {
    enabled: boolean;
    /** Released games whose page was due this run. */
    due: number;
    /** Of those, games looked up (a search fallback adds requests, not games). */
    checked: number;
    requestsUsed: number;
    budgetExhausted: boolean;
    stoppedBecause: string | null;
    errors: string[];
  };
  linkErrors: string[];
}

export function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch (err) {
    // Hand-edited files (free-updates.json, studios-overrides.json): say which one is broken.
    throw new Error(`Invalid JSON in ${path}: ${(err as Error).message}`, { cause: err });
  }
}

export function writeJson(path: string, data: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

export const emptyLinks = (): LinksCache => ({
  fetchedAt: new Date(0).toISOString(),
  wikipediaBySlug: {},
  wikipediaByTitle: {},
  nintendoWikiByTitle: {},
  eshopEuBySlug: {},
  eshopUsBySlug: {},
  opencriticBySlug: {},
});
