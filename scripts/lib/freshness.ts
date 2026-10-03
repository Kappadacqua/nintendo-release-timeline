/**
 * When each data source was last read, and when each game's scores are read again: for the
 * admin panel (GET /__admin/freshness). No network; it only reads the caches in data/cache/.
 * Imports nothing that loads .env, so the Vite admin plugin can use it.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { metacriticMaxDays, type MetacriticStatus, OPENCRITIC_RETRY_MISS_DAYS, opencriticMaxAgeDays } from "./refresh-policy";

const DAY_MS = 86_400_000;

export interface SourceFreshness {
  key: string;
  label: string;
  /** Last time the source answered (ISO); null = never, or manual only. */
  updatedAt: string | null;
  /** What it covers and how it is refreshed, plus counts. */
  detail: string;
}

export interface CheckFreshness {
  /** Last read (ISO); null = never. */
  checkedAt: string | null;
  /** Earliest data:fetch that reads it again (ISO); null = never. In the past = at the next fetch. */
  nextAt: string | null;
  note: string;
}

export interface FreshnessReport {
  sources: SourceFreshness[];
  /** The last data:fetch / data:fetch-metacritic, from data/cache/fetch-status.json. */
  lastRun: { at: string; opencritic: string; metacritic: string | null } | null;
  games: Record<string, { opencritic?: CheckFreshness; metacritic?: CheckFreshness }>;
}

interface Dated {
  fetchedAt?: string;
}

export interface FreshnessInput {
  games: { id: string; kind: string; firstReleaseDate: string | null; links: { opencritic?: string | null } }[];
  igdb: Dated | null;
  wikipedia: Dated | null;
  links: Dated | null;
  freeUpdates: Dated | null;
  studios: Dated | null;
  opencritic: {
    matches?: Record<string, { opencriticId: number | null; searchedAt: string }>;
    games?: Record<string, { fetchedAt: string }>;
    catalog?: { fetchedAt: string };
  } | null;
  metacritic: { games?: Record<string, { status: MetacriticStatus; checkedAt: string; inheritedFrom?: string }> } | null;
  fetchStatus: {
    fetchedAt: string;
    opencritic: { enabled: boolean; searchesUsed: number; requestsUsed: number; budgetExhausted: boolean; stoppedBecause: string | null; queued?: number };
    metacritic?: { enabled: boolean; due: number; checked: number; requestsUsed: number; budgetExhausted: boolean; stoppedBecause: string | null };
  } | null;
}

const MC_NOTE: Record<MetacriticStatus, string> = {
  ok: "page read",
  "not-found": "no page found",
  mismatch: "page of another game",
  gone: "page removed (410), never checked again",
};

const plusDays = (iso: string, days: number) => new Date(Date.parse(iso) + days * DAY_MS).toISOString();
const latest = (dates: string[]) => dates.reduce<string | null>((max, d) => (!max || d > max ? d : max), null);

export function computeFreshness(input: FreshnessInput, now = Date.now()): FreshnessReport {
  const today = new Date(now).toISOString().slice(0, 10);
  const ocGames = input.opencritic?.games ?? {};
  const ocMatches = input.opencritic?.matches ?? {};
  const mcGames = input.metacritic?.games ?? {};

  // Only released games with scores are read (free updates never have any).
  const games: FreshnessReport["games"] = {};
  for (const g of input.games) {
    if (g.kind === "free-update" || !g.firstReleaseDate || g.firstReleaseDate > today) continue;
    const daysSinceRelease = Math.floor((now - Date.parse(g.firstReleaseDate)) / DAY_MS);

    const match = ocMatches[g.id];
    const ocId = /\/game\/(\d+)/.exec(g.links.opencritic ?? "")?.[1] ?? (match?.opencriticId ? String(match.opencriticId) : null);
    const ocData = ocId ? ocGames[ocId] : undefined;
    let opencritic: CheckFreshness;
    if (ocData) {
      opencritic = { checkedAt: ocData.fetchedAt, nextAt: plusDays(ocData.fetchedAt, opencriticMaxAgeDays(daysSinceRelease)), note: `score read (id ${ocId})` };
    } else if (ocId) {
      opencritic = { checkedAt: null, nextAt: null, note: `page matched (id ${ocId}), score not read yet` };
    } else if (match) {
      opencritic = { checkedAt: match.searchedAt, nextAt: plusDays(match.searchedAt, OPENCRITIC_RETRY_MISS_DAYS), note: "no page found, searched again later" };
    } else {
      opencritic = { checkedAt: null, nextAt: null, note: "never looked up" };
    }

    const entry = mcGames[g.id];
    let metacritic: CheckFreshness;
    if (entry) {
      const maxDays = metacriticMaxDays(entry.status, daysSinceRelease);
      const inherited = entry.inheritedFrom ? ` (base game: ${entry.inheritedFrom})` : "";
      metacritic = { checkedAt: entry.checkedAt, nextAt: maxDays === null ? null : plusDays(entry.checkedAt, maxDays), note: MC_NOTE[entry.status] + inherited };
    } else {
      metacritic = { checkedAt: null, nextAt: null, note: "never looked up" };
    }
    games[g.id] = { opencritic, metacritic };
  }

  const nowIso = new Date(now).toISOString();
  const dueNow = (key: "opencritic" | "metacritic") =>
    Object.values(games).filter((g) => {
      const c = g[key]!;
      return c.checkedAt === null ? c.note === "never looked up" : c.nextAt !== null && c.nextAt <= nowIso;
    }).length;
  const ocDates = Object.values(ocGames).map((g) => g.fetchedAt);
  const mcDates = Object.values(mcGames).map((g) => g.checkedAt);
  const catalog = input.opencritic?.catalog?.fetchedAt;

  const sources: SourceFreshness[] = [
    { key: "igdb", label: "IGDB", updatedAt: input.igdb?.fetchedAt ?? null, detail: "Games, dates, developers · every data:fetch" },
    { key: "wikipedia", label: "Wikipedia", updatedAt: input.wikipedia?.fetchedAt ?? null, detail: "Switch 2 exclusives · every data:fetch" },
    { key: "links", label: "Links", updatedAt: input.links?.fetchedAt ?? null, detail: "Wikidata, Wikipedia, Nintendo Wiki, eShop · every data:fetch" },
    {
      key: "opencritic",
      label: "OpenCritic",
      updatedAt: latest(ocDates),
      detail: `${ocDates.length} scores · daily for 45 days after release, then every 14 · ${dueNow("opencritic")} due at the next fetch${catalog ? ` · Switch 2 catalog ${catalog.slice(0, 10)}` : ""}`,
    },
    {
      key: "metacritic",
      label: "Metacritic",
      updatedAt: latest(mcDates),
      detail: `${mcDates.length} pages · daily for 60 days after release, then weekly · ${dueNow("metacritic")} due at the next fetch`,
    },
    { key: "backloggd", label: "Backloggd", updatedAt: null, detail: "Manual only, from this panel" },
    { key: "freeUpdates", label: "Free updates", updatedAt: input.freeUpdates?.fetchedAt ?? null, detail: "IGDB, Wikipedia, Nintendo Wiki · data:fetch-free-updates" },
    { key: "studios", label: "Studios", updatedAt: input.studios?.fetchedAt ?? null, detail: "Nintendo Wiki · data:fetch-studios" },
  ];

  const s = input.fetchStatus;
  const stop = (x: { budgetExhausted: boolean; stoppedBecause: string | null }) =>
    x.stoppedBecause ? ` · stopped: ${x.stoppedBecause}` : x.budgetExhausted ? " · budget reached" : "";
  const lastRun = s && {
    at: s.fetchedAt,
    opencritic: s.opencritic.enabled
      ? `${s.opencritic.searchesUsed} searches, ${s.opencritic.requestsUsed} requests${s.opencritic.queued ? ` · ${s.opencritic.queued} queued` : ""}${stop(s.opencritic)}`
      : "disabled (no RAPIDAPI_KEY)",
    metacritic: s.metacritic
      ? s.metacritic.enabled
        ? `${s.metacritic.checked} of ${s.metacritic.due} due checked, ${s.metacritic.requestsUsed} requests${stop(s.metacritic)}`
        : "disabled"
      : null,
  };
  return { sources, lastRun, games };
}

export function readFreshness(root: string): FreshnessReport {
  const read = <T>(path: string): T | null => {
    const file = join(root, path);
    return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : null;
  };
  return computeFreshness({
    games: read<{ games: FreshnessInput["games"] }>("public/data/games.json")?.games ?? [],
    igdb: read("data/cache/igdb.json"),
    wikipedia: read("data/cache/wikipedia.json"),
    links: read("data/cache/links.json"),
    freeUpdates: read("data/cache/free-updates.json"),
    studios: read("data/cache/studios.json"),
    opencritic: read("data/cache/opencritic.json"),
    metacritic: read("data/cache/metacritic.json"),
    fetchStatus: read("data/cache/fetch-status.json"),
  });
}
