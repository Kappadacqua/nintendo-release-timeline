/**
 * How often each score source is read again (SPEC §4). Shared by the fetch scripts and the
 * admin panel's "next check" dates; no imports, so the Vite admin plugin can load it.
 */

export type MetacriticStatus = "ok" | "not-found" | "gone" | "mismatch";

/**
 * Days before a Metacritic page is looked up again: a page found daily for the first 60 days
 * after release, then weekly; a missing page (404) after 3 days, 30 once the game is a month
 * old; another game's page after 3 days, then 14; a removed page (410) never (null).
 */
export function metacriticMaxDays(status: MetacriticStatus, daysSinceRelease: number): number | null {
  if (status === "gone") return null;
  if (status === "ok") return daysSinceRelease < 60 ? 1 : 7;
  return daysSinceRelease < 30 ? 3 : status === "not-found" ? 30 : 14;
}

/** A matched game's OpenCritic details are fetched again after this many days: daily for 45 days after release, then every 14. */
export const opencriticMaxAgeDays = (daysSinceRelease: number) => (daysSinceRelease < 45 ? 1 : 14);

/** A title with no OpenCritic page is searched again after this many days. */
export const OPENCRITIC_RETRY_MISS_DAYS = 30;
