import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fetchJson, Throttle } from "./http";

const HOST = "opencritic-api.p.rapidapi.com";
const DAY_MS = 86_400_000;

export interface OpenCriticGame {
  id: number;
  name: string;
  url?: string;
  topCriticScore: number; // -1 when not enough reviews
  numTopCriticReviews: number;
  numReviews: number;
}

interface SearchHit {
  id: number;
  name: string;
  dist: number; // 0 = perfect trigram match, 1 = no overlap
}

/** One row of the platform listing (GET /game): has the score, not the top-critic count. */
export interface CatalogEntry {
  id: number;
  name: string;
  url?: string;
  firstReleaseDate?: string;
  topCriticScore: number; // -1 when not enough reviews
  numReviews: number;
}

export interface OpenCriticCache {
  /** IGDB id → OpenCritic id (null = searched, nothing close enough). */
  matches: Record<string, { opencriticId: number | null; searchedAt: string }>;
  games: Record<string, { data: OpenCriticGame; fetchedAt: string }>;
  /** Every Switch 2 game on OpenCritic: title matching without spending searches. */
  catalog?: { fetchedAt: string; games: CatalogEntry[] };
}

/** OpenCritic's filter takes the platform's shortName, space included. */
const CATALOG_PLATFORM = "Switch 2";
const PAGE_SIZE = 20;

/** The cache on disk, for data:build (no client, no network). */
export function loadOpenCriticCache(path: string): OpenCriticCache {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as OpenCriticCache) : { matches: {}, games: {} };
}

export interface OpenCriticBudget {
  searches: number;
  requests: number;
}

/** Title normalization shared by both sides of the fuzzy match. */
function normalize(title: string) {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * OpenCritic via RapidAPI. The free plan allows ~25 searches and ~200 requests
 * per day, so ID matches and scores are cached on disk and every run has a budget.
 */
export class OpenCritic {
  private readonly throttle = new Throttle(300);
  private readonly cache: OpenCriticCache;
  readonly used = { searches: 0, requests: 0 };
  budgetExhausted = false;
  private catalogByTitle = new Map<string, CatalogEntry>();
  private catalogById = new Map<number, CatalogEntry>();

  constructor(
    private readonly apiKey: string,
    private readonly cachePath: string,
    private readonly budget: OpenCriticBudget,
  ) {
    this.cache = existsSync(cachePath)
      ? loadOpenCriticCache(cachePath)
      : { matches: {}, games: {} };
  }

  save() {
    mkdirSync(dirname(this.cachePath), { recursive: true });
    writeFileSync(this.cachePath, `${JSON.stringify(this.cache, null, 2)}\n`);
  }

  private get<T>(path: string) {
    return fetchJson<T>(`https://${HOST}${path}`, {
      headers: { "x-rapidapi-key": this.apiKey, "x-rapidapi-host": HOST },
      throttle: this.throttle,
      label: `OpenCritic ${path}`,
    });
  }

  /**
   * Loads the Switch 2 catalog (~40 requests), reusing the cached copy while it is
   * younger than `maxAgeDays`. A partial download is merged into the old copy.
   */
  async loadCatalog(maxAgeDays: number) {
    const cached = this.cache.catalog;
    const fresh = cached && Date.now() - Date.parse(cached.fetchedAt) < maxAgeDays * DAY_MS;
    if (!fresh) {
      const rows: CatalogEntry[] = [];
      let complete = false;
      for (let skip = 0; this.used.requests < this.budget.requests; skip += PAGE_SIZE) {
        this.used.requests++;
        // Sorted by name so offset paging stays stable while scores change.
        const page = await this.get<CatalogEntry[]>(
          `/game?platforms=${encodeURIComponent(CATALOG_PLATFORM)}&sort=name&order=asc&skip=${skip}`,
        );
        rows.push(...page.map(({ id, name, url, firstReleaseDate, topCriticScore, numReviews }) => ({ id, name, url, firstReleaseDate, topCriticScore, numReviews })));
        if (page.length < PAGE_SIZE) {
          complete = true;
          break;
        }
      }
      if (!complete) this.budgetExhausted = true;
      const merged = new Map((complete ? [] : (cached?.games ?? [])).map((g) => [g.id, g]));
      for (const g of rows) merged.set(g.id, g);
      // Only a complete download counts as fresh; a partial one is retried next run.
      this.cache.catalog = { fetchedAt: complete ? new Date().toISOString() : (cached?.fetchedAt ?? new Date(0).toISOString()), games: [...merged.values()] };
    }
    for (const g of this.cache.catalog?.games ?? []) {
      this.catalogById.set(g.id, g);
      const key = normalize(g.name);
      // Same title twice: keep the one with more reviews (the main entry, not a port).
      const prev = this.catalogByTitle.get(key);
      if (!prev || g.numReviews > prev.numReviews) this.catalogByTitle.set(key, g);
    }
    return this.catalogById.size;
  }

  catalogEntry(id: number) {
    return this.catalogById.get(id);
  }

  /** After a quota / auth error: no more network calls, answers come from the cache only. */
  goOffline(reason: string) {
    this.budget.searches = this.used.searches;
    this.budget.requests = this.used.requests;
    this.offlineReason ??= reason;
  }

  /** Searches have their own, smaller daily quota: running out of it must not stop plain requests. */
  stopSearches(reason: string) {
    this.budget.searches = this.used.searches;
    this.searchesStopped ??= reason;
  }

  searchesStopped: string | null = null;

  /** Why calls were stopped early (quota, key), if they were. */
  offlineReason: string | null = null;

  /**
   * OpenCritic id for an IGDB game from the cache or a new search (misses are
   * retried after `retryMissAfterDays`). null = no page; undefined = unknown (budget spent).
   */
  async resolveId(igdbId: string, title: string, retryMissAfterDays: number): Promise<number | null | undefined> {
    const cached = this.cache.matches[igdbId];
    if (cached?.opencriticId) return cached.opencriticId;
    // Exact (normalized) title in the Switch 2 catalog: free, and fixes old failed searches.
    const inCatalog = this.catalogByTitle.get(normalize(title));
    if (inCatalog) {
      this.cache.matches[igdbId] = { opencriticId: inCatalog.id, searchedAt: new Date().toISOString() };
      return inCatalog.id;
    }
    if (cached && Date.now() - Date.parse(cached.searchedAt) < retryMissAfterDays * DAY_MS) return null;
    if (this.used.searches >= this.budget.searches) {
      this.budgetExhausted = true;
      return cached ? null : undefined;
    }

    this.used.searches++;
    const hits = await this.get<SearchHit[]>(`/game/search?criteria=${encodeURIComponent(title)}`);
    const wanted = normalize(title);
    const best =
      hits.find((h) => normalize(h.name) === wanted) ??
      hits.filter((h) => h.dist <= 0.25).sort((a, b) => a.dist - b.dist)[0];
    this.cache.matches[igdbId] = { opencriticId: best?.id ?? null, searchedAt: new Date().toISOString() };
    return best?.id ?? null;
  }

  /** Game details, from cache while younger than `maxAgeDays`. */
  async game(id: number, maxAgeDays: number): Promise<OpenCriticGame | null> {
    const cached = this.cache.games[id];
    if (cached && Date.now() - Date.parse(cached.fetchedAt) < maxAgeDays * DAY_MS) return cached.data;
    if (this.used.requests >= this.budget.requests) {
      this.budgetExhausted = true;
      return cached?.data ?? null;
    }

    this.used.requests++;
    const g = await this.get<OpenCriticGame>(`/game/${id}`);
    const data: OpenCriticGame = {
      id: g.id,
      name: g.name,
      url: g.url,
      topCriticScore: g.topCriticScore,
      numTopCriticReviews: g.numTopCriticReviews,
      numReviews: g.numReviews,
    };
    this.cache.games[id] = { data, fetchedAt: new Date().toISOString() };
    return data;
  }
}
