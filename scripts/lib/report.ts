/** data/fetch-report.json: what the last fetch could not decide on its own, read by data:validate. */
export interface FetchReport {
  generatedAt: string;
  /** When data:fetch last ran (the build itself uses only the cache). */
  fetchedAt?: string | null;
  counts: { candidates: number; included: number };
  exclusivityConflicts: { id: string; title: string; issue: string }[];
  wikipediaUnmatched: { title: string; wikidataId: string | null }[];
  opencritic: {
    enabled: boolean;
    searchesUsed: number;
    requestsUsed: number;
    budgetExhausted: boolean;
    /** Released games with no OpenCritic match (candidates for `opencriticId`). */
    unmatched: { id: string; title: string }[];
    errors: string[];
    /** Released games whose score could not be checked this run: previous games.json value kept. */
    keptPrevious: { id: string; title: string }[];
    /** Switch 2 games in the cached OpenCritic catalog. */
    catalogSize: number;
    /** Why calls stopped early (daily quota, rejected key), if they did. */
    stoppedBecause?: string | null;
    /** Games never looked up because the budget ran out: first in line next run. */
    queued?: number;
  };
  /** Metacritic pages (data/cache/metacritic.json) of released games. */
  metacritic?: {
    enabled: boolean;
    requestsUsed: number;
    budgetExhausted: boolean;
    stoppedBecause: string | null;
    errors: string[];
    /** No page at the slug made from the title (candidates for links.metacritic). */
    notFound: { id: string; title: string; slug: string }[];
    /** The page at that slug is another game (name on the page given). */
    mismatched: { id: string; title: string; slug: string; name: string }[];
    /** Released games never looked up yet. */
    unchecked: number;
  };
  /** Wikipedia / Nintendo Wiki lookups that failed (previous links kept). */
  linkErrors: string[];
  /** DLC / Switch 2 Editions left out because no OpenCritic page was found (SPEC §3). */
  excludedWithoutReviewPage: { id: string; title: string; kind: string }[];
  /** DLC / Switch 2 Editions kept without that check (OpenCritic off or out of budget). */
  unverifiedReviewPage: { id: string; title: string; kind: string }[];
  /**
   * data/free-updates.json entries left out (same game already listed), not found on IGDB, or
   * matched by release year only.
   */
  freeUpdates?: { created: number; duplicates: { title: string; of: string }[]; notOnIgdb: string[]; approximate?: string[]; invalid?: string[] };
  /**
   * IGDB developers of first-party games that match no Nintendo Wiki studio (data/studios-overrides.json),
   * and games of hidden or closed wiki studios.
   */
  studiosUnmatched?: { developer: string; titles: string[] }[];
  /** data/cache/studios.json missing or empty when studios.json was built. */
  studiosCacheEmpty?: boolean;
  /** Names claimed by two Nintendo Wiki studios ("name — kept, not ignored"). */
  studiosNameCollisions?: string[];
  /** data/studios-overrides.json keys that are no wiki page and no game's developer (renamed page?). */
  studiosUnusedOverrides?: string[];
}
