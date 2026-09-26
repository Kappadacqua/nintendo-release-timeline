/** data/fetch-report.json: what the last fetch could not decide on its own, read by data:validate. */
export interface FetchReport {
  generatedAt: string;
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
  };
  /** DLC / Switch 2 Editions left out because no OpenCritic page was found (SPEC §3). */
  excludedWithoutReviewPage: { id: string; title: string; kind: string }[];
  /** DLC / Switch 2 Editions kept without that check (OpenCritic off or out of budget). */
  unverifiedReviewPage: { id: string; title: string; kind: string }[];
}
