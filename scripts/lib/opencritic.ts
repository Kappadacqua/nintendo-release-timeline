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

interface Cache {
  /** IGDB id → OpenCritic id (null = searched, nothing close enough). */
  matches: Record<string, { opencriticId: number | null; searchedAt: string }>;
  games: Record<string, { data: OpenCriticGame; fetchedAt: string }>;
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
  private readonly cache: Cache;
  readonly used = { searches: 0, requests: 0 };
  budgetExhausted = false;

  constructor(
    private readonly apiKey: string,
    private readonly cachePath: string,
    private readonly budget: OpenCriticBudget,
  ) {
    this.cache = existsSync(cachePath)
      ? (JSON.parse(readFileSync(cachePath, "utf8")) as Cache)
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

  /** After a quota / auth error: no more network calls, answers come from the cache only. */
  goOffline() {
    this.budget.searches = this.used.searches;
    this.budget.requests = this.used.requests;
    this.budgetExhausted = true;
  }

  /**
   * OpenCritic id for an IGDB game from the cache or a new search (misses are
   * retried after `retryMissAfterDays`). null = no page; undefined = unknown (budget spent).
   */
  async resolveId(igdbId: string, title: string, retryMissAfterDays: number): Promise<number | null | undefined> {
    const cached = this.cache.matches[igdbId];
    if (cached?.opencriticId) return cached.opencriticId;
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
