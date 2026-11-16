import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fetchJson, Throttle } from "./http";
import { isDueAfter, researchDays } from "./refresh-policy";
import { titleVariants } from "./title-variants";

const HOST = "opencritic-api.p.rapidapi.com";

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

export interface OpenCriticCache {
  /**
   * IGDB id → OpenCritic id (null = searched, nothing close enough). `matchedTitle`: the shorter
   * title (the base game's, SPEC §4.2) that found the page, when not the full one; `titlesTried`:
   * how many titles a miss tried (absent = only the full one).
   */
  matches: Record<string, { opencriticId: number | null; searchedAt: string; matchedTitle?: string; titlesTried?: number }>;
  games: Record<string, { data: OpenCriticGame; fetchedAt: string }>;
}

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

const FILLER = new Set(["the", "a", "an", "of", "and"]);

/**
 * A close title may differ only in filler words: "Xenoblade Chronicles 2 … Switch 2 Edition"
 * is not "Xenoblade Chronicles … Switch 2 Edition", nor "Xenoblade Chronicles X …", however
 * small the text distance. Anything else is forced with opencriticId in the overrides.
 */
function sameWords(a: string, b: string) {
  const words = (t: string) => normalize(t).split(" ").filter((w) => !FILLER.has(w)).sort().join(" ");
  return words(a) === words(b);
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
    // The Switch 2 catalog of older versions is no longer used (SPEC §4.2).
    const { matches, games } = this.cache;
    writeFileSync(this.cachePath, `${JSON.stringify({ matches, games }, null, 2)}\n`);
  }

  private get<T>(path: string) {
    return fetchJson<T>(`https://${HOST}${path}`, {
      headers: { "x-rapidapi-key": this.apiKey, "x-rapidapi-host": HOST },
      throttle: this.throttle,
      label: `OpenCritic ${path}`,
      // RapidAPI's 429 is the daily quota: retrying only spends more of it.
      retry429: false,
    });
  }

  /** Looked up before (found or not). */
  hasMatch(igdbId: string) {
    return igdbId in this.cache.matches;
  }

  /** After a quota / auth error: no more network calls, answers come from the cache only. */
  goOffline(reason: string) {
    this.budget.searches = this.used.searches;
    this.budget.requests = this.used.requests;
    this.offlineReason ??= reason;
  }

  /** Why calls were stopped early (quota, key), if they were. */
  offlineReason: string | null = null;

  /**
   * OpenCritic id for an IGDB game from the cache or a new search. The game's own page, once
   * found, is never searched again. A provisional answer — no page (null), or the base game's
   * page found with a shorter title — is searched again on the `researchDays` curve (searchedAt =
   * last try). null = no page; undefined = unknown (budget spent).
   */
  async resolveId(igdbId: string, title: string, daysSinceRelease: number, knownId?: number, now = Date.now()): Promise<number | null | undefined> {
    // Forced in overrides.json or from Wikidata: wins over any title match.
    if (knownId) {
      this.cache.matches[igdbId] = { opencriticId: knownId, searchedAt: new Date(now).toISOString() };
      return knownId;
    }
    const cached = this.cache.matches[igdbId];
    if (cached?.opencriticId && !cached.matchedTitle) return cached.opencriticId;
    const variants = titleVariants(title);
    // A miss searched before the shorter titles existed is due now.
    const allTried = cached?.opencriticId ? true : (cached?.titlesTried ?? 1) >= variants.length;
    if (cached && allTried && !isDueAfter(cached.searchedAt, researchDays(daysSinceRelease), now)) return cached.opencriticId;

    // Full title first, then the base game's shorter titles.
    for (const [i, candidate] of variants.entries()) {
      if (this.used.searches >= this.budget.searches) {
        this.budgetExhausted = true;
        return cached ? cached.opencriticId : undefined;
      }
      this.used.searches++;
      const hits = await this.get<SearchHit[]>(`/game/search?criteria=${encodeURIComponent(candidate)}`);
      const wanted = normalize(candidate);
      const best =
        hits.find((h) => normalize(h.name) === wanted) ??
        hits.filter((h) => h.dist <= 0.25 && sameWords(h.name, candidate)).sort((a, b) => a.dist - b.dist)[0];
      if (best) return this.setMatch(igdbId, best.id, now, i > 0 ? candidate : undefined);
    }
    // Nothing this time: a base game's page found before stays until a search finds better.
    if (cached?.opencriticId) return this.setMatch(igdbId, cached.opencriticId, now, cached.matchedTitle);
    return this.setMatch(igdbId, null, now, undefined, variants.length);
  }

  private setMatch(igdbId: string, opencriticId: number | null, now: number, matchedTitle?: string, titlesTried?: number) {
    this.cache.matches[igdbId] = {
      opencriticId,
      searchedAt: new Date(now).toISOString(),
      ...(matchedTitle ? { matchedTitle } : {}),
      ...(titlesTried && titlesTried > 1 ? { titlesTried } : {}),
    };
    return opencriticId;
  }

  /** Game details (the score), from cache until `maxAgeDays` have passed (`isDueAfter`). */
  async game(id: number, maxAgeDays: number, now = Date.now()): Promise<OpenCriticGame | null> {
    const cached = this.cache.games[id];
    if (cached && !isDueAfter(cached.fetchedAt, maxAgeDays, now)) return cached.data;
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
    this.cache.games[id] = { data, fetchedAt: new Date(now).toISOString() };
    return data;
  }
}
