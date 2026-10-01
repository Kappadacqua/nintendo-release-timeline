import type { Game } from "../../src/types";
import type { MetacriticCache } from "./metacritic";
import { type AbsentSource, isAbsent, type Override } from "./overrides";

/**
 * What is still missing for each game, and why (data:validate). A source marked
 * `absent: { "<source>": { "status": "none" } }` in the overrides is never listed;
 * games not out yet (TBA zone, future dates) have no scores to look for.
 */

/** Why a value is missing: never looked up, looked up without a page, or a page without a score. */
export type GapState = "not looked up" | "no page found" | "page of another game" | "no score on the page" | "tbd" | "to enter by hand";

export interface Gap {
  source: string;
  state: GapState;
}

export interface GameGaps {
  id: string;
  title: string;
  date: string | null;
  gaps: Gap[];
}

export interface Gaps {
  /** Released games with a missing Metacritic or Backloggd value. */
  scores: GameGaps[];
  /** Dated games (not the TBA zone) without a Wikipedia, Nintendo Wiki or Nintendo Store link. */
  links: GameGaps[];
  /** Values skipped because there is none for sure (override, or a page Metacritic removed), per source. */
  confirmedNone: Partial<Record<AbsentSource, number>>;
}

export const isReleased = (g: Pick<Game, "firstReleaseDate">, today: string) => !!g.firstReleaseDate && g.firstReleaseDate <= today;

export function gapsOf(games: Game[], overrides: Record<string, Override>, mc: MetacriticCache, today: string): Gaps {
  const out: Gaps = { scores: [], links: [], confirmedNone: {} };
  const confirmed = (o: Override | undefined, source: AbsentSource) => {
    if (!isAbsent(o, source)) return false;
    out.confirmedNone[source] = (out.confirmedNone[source] ?? 0) + 1;
    return true;
  };

  for (const g of games) {
    const o = overrides[g.id];
    if (g.kind !== "free-update" && isReleased(g, today)) {
      const gaps: Gap[] = [];
      const missingCritic = !g.scores.critic.metacritic;
      const missingUser = !g.scores.user.metacritic;
      const page = mc.games[g.id];
      if (!g.scores.critic.opencritic) confirmed(o, "opencritic");
      if (page?.status === "gone" && (missingCritic || missingUser)) {
        // HTTP 410: Metacritic removed the page, as final as a confirmed absence.
        out.confirmedNone.metacritic = (out.confirmedNone.metacritic ?? 0) + 1;
      } else if ((missingCritic || missingUser) && !confirmed(o, "metacritic")) {
        const pageState: GapState | null = !page
          ? "not looked up"
          : page.status === "not-found"
            ? "no page found"
            : page.status === "mismatch"
              ? "page of another game"
              : null;
        if (missingCritic) gaps.push({ source: "Metacritic critic", state: pageState ?? (page?.criticTbd ? "tbd" : "no score on the page") });
        if (missingUser) gaps.push({ source: "Metacritic user", state: pageState ?? (page?.userTbd ? "tbd" : "no score on the page") });
      }
      if (!g.scores.user.backloggd && !confirmed(o, "backloggd")) gaps.push({ source: "Backloggd", state: "to enter by hand" });
      if (gaps.length) out.scores.push({ id: g.id, title: g.title, date: g.firstReleaseDate, gaps });
    }

    // TBA zone: nothing to link yet.
    if (g.firstReleaseDate) {
      const gaps = (["wikipedia", "nintendoWiki", "nintendoStore"] as const)
        .filter((key) => !g.links[key] && !confirmed(o, key))
        .map((key) => ({ source: LINK_NAMES[key], state: "no page found" as const }));
      if (gaps.length) out.links.push({ id: g.id, title: g.title, date: g.firstReleaseDate, gaps });
    }
  }
  return out;
}

const LINK_NAMES = { wikipedia: "Wikipedia", nintendoWiki: "Nintendo Wiki", nintendoStore: "Nintendo Store" } as const;
