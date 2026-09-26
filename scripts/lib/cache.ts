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
  };
  linkErrors: string[];
}

export function readJson<T>(path: string, fallback: T): T {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : fallback;
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
});
