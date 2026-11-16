/**
 * How often each score source is read again (SPEC §4). Shared by the fetch scripts and the
 * admin panel's "next check" dates; no imports, so the Vite admin plugin can load it.
 *
 * One curve for OpenCritic and Metacritic: reviews come out in the first weeks after release,
 * then dry up, so pages are read less and less often.
 */

export type MetacriticStatus = "ok" | "not-found" | "gone" | "mismatch";

const DAY_MS = 86_400_000;
/** A run a little earlier than the previous one (the daily cron drifts) still counts as a day later. */
export const REFRESH_SLACK_MS = 2 * 3_600_000;

/** Days between two reads of a game's score: daily for 2 weeks, every 3 days to week 4, weekly to week 12, then monthly. */
export function scoreRefreshDays(daysSinceRelease: number): number {
  if (daysSinceRelease < 14) return 1;
  if (daysSinceRelease < 28) return 3;
  if (daysSinceRelease < 84) return 7;
  return 30;
}

/**
 * Days before a provisional link is searched again — no page found, or the base game's page
 * (a Switch 2 Edition on the Switch 1 page): the same curve once released, weekly before.
 */
export const researchDays = (daysSinceRelease: number) => (daysSinceRelease < 0 ? 7 : scoreRefreshDays(daysSinceRelease));

/** Whether something done at `doneAt` is due again after `days` days. */
export const isDueAfter = (doneAt: string, days: number, now = Date.now()) => now - Date.parse(doneAt) >= days * DAY_MS - REFRESH_SLACK_MS;

/**
 * Days before a Metacritic page is looked up again: a found page on the score curve, a missing
 * page or another game's page on the search curve, a removed page (410) never (null).
 */
export function metacriticMaxDays(status: MetacriticStatus, daysSinceRelease: number): number | null {
  if (status === "gone") return null;
  return status === "ok" ? scoreRefreshDays(daysSinceRelease) : researchDays(daysSinceRelease);
}
