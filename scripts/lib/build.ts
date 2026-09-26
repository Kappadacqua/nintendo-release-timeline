import type { ChangesFile, Game, GamesFile } from "../../src/types";
import { type FetchStatus, type IgdbCache, type LinksCache, readJson, type WikipediaCache, emptyLinks, writeJson } from "./cache";
import { PATHS } from "./env";
import { ExclusivityHistory } from "./exclusivity";
import { type IgdbGame, PLATFORM } from "./igdb";
import { baseTitleOfEdition, wikipediaUrl } from "./links";
import { loadOpenCriticCache } from "./opencritic";
import { applyOverride, loadOverrides, manualToGame, type OverridesFile, score } from "./overrides";
import type { FetchReport } from "./report";
import { addHistory, changesOf, readSnapshots } from "./snapshots";
import { igdbExclusive, inDateRange, isExcludedType, isOnSwitch, kindOf, releaseInfo, toGame } from "./transform";

/** A game inside the perimeter, before scores, links and overrides. */
export interface Selected {
  game: Game;
  /** Forced in by overrides / manual games: skips the automatic rules. */
  forced: boolean;
  /** IGDB slug (links) and base game id for DLC / Switch 2 Editions. */
  slug?: string;
  baseId?: number;
  /** Exclusive by IGDB platforms or the Wikipedia category, this run. */
  exclusiveNow: boolean;
  /** Wikipedia and IGDB disagree about exclusivity. */
  conflict?: string;
}

export interface Selection {
  selected: Selected[];
  /** Wikipedia page title per game id, from the category match. */
  wikiPageById: Map<string, string>;
  wikipediaUnmatched: { title: string; wikidataId: string | null }[];
  candidates: Map<number, IgdbGame>;
}

/**
 * The perimeter (SPEC §3), shared by data:fetch (to know what to query) and
 * data:build (to write games.json), so the two can never disagree.
 */
export function selectGames(igdb: IgdbCache, wiki: WikipediaCache, overridesFile: OverridesFile): Selection {
  const overrides = overridesFile.games;
  const candidates = new Map(igdb.games.map((g) => [g.id, g]));
  const firstParty = new Set(igdb.firstPartyIds);

  const wikiIds = new Set<number>();
  const wikiManualIds = new Set<string>();
  const wikiPageById = new Map<string, string>();
  const wikipediaUnmatched: Selection["wikipediaUnmatched"] = [];
  for (const page of wiki.pages) {
    const forced = overridesFile.wikipedia[page.title];
    const ids = forced ?? (wiki.matches[page.title] != null ? [`igdb:${wiki.matches[page.title]}`] : []);
    if (!ids.length) wikipediaUnmatched.push({ title: page.title, wikidataId: page.wikidataId });
    for (const id of ids) {
      wikiPageById.set(id, page.title);
      if (id.startsWith("manual:")) wikiManualIds.add(id);
      else wikiIds.add(Number(id.slice(5)));
    }
  }

  const selected: Selected[] = [];
  for (const g of candidates.values()) {
    const override = overrides[`igdb:${g.id}`];
    if (override?.include === false) continue;
    const forced = override?.include === true;
    const info = releaseInfo(g);
    if (!forced && (isExcludedType(g) || !isOnSwitch(g) || !inDateRange(g, info))) continue;

    // A first-party parent only brings in DLC and Switch 2 Editions: on IGDB remakes, remasters
    // and ports also have a parent_game (e.g. third-party remakes of games Nintendo once published).
    const kind = kindOf(g);
    const parentId = g.parent_game?.id ?? g.version_parent;
    const isChild = kind !== "game" && parentId !== undefined && firstParty.has(parentId);
    if (!forced && !firstParty.has(g.id) && !isChild && !wikiIds.has(g.id)) continue;
    // Other editions of a game (Special Edition, collections…) duplicate the base game.
    if (!forced && g.version_parent && kind !== "switch2-edition") continue;

    const game = toGame(g, info);
    game.firstParty = firstParty.has(g.id) || isChild;
    const exIgdb = igdbExclusive(g);
    const exWiki = wikiIds.has(g.id);
    let conflict: string | undefined;
    if (exWiki && !exIgdb) conflict = "In the Wikipedia Switch 2-only category, but IGDB lists other platforms";
    else if (!exWiki && exIgdb && kind === "game" && (g.platforms ?? []).every((p) => p === PLATFORM.SWITCH_2)) {
      conflict = "Switch 2-only on IGDB, but missing from the Wikipedia category";
    }
    selected.push({
      game,
      forced,
      slug: g.slug,
      baseId: kind !== "game" ? parentId : undefined,
      exclusiveNow: exIgdb || exWiki,
      conflict,
    });
  }

  // Hand-written games missing from IGDB: always shown unless "include": false.
  for (const m of overridesFile.manualGames) {
    if (overrides[m.id]?.include === false) continue;
    const game = manualToGame(m);
    selected.push({
      game,
      forced: true,
      exclusiveNow: m.exclusivity === "exclusive" || (m.exclusivity === undefined && wikiManualIds.has(m.id)),
    });
  }
  return { selected, wikiPageById, wikipediaUnmatched, candidates };
}

export function loadSelectionInputs() {
  return {
    igdb: readJson<IgdbCache>(PATHS.igdbCache, { fetchedAt: "", firstPartyIds: [], games: [] }),
    wiki: readJson<WikipediaCache>(PATHS.wikipediaCache, { fetchedAt: "", pages: [], matches: {} }),
    overridesFile: loadOverrides(PATHS.overrides),
  };
}

type StoreRegion = "EU" | "US";

/** data/settings.json: which Nintendo Store the button opens (ITERATION-3 §7). */
export interface Settings {
  nintendoStore: {
    region: StoreRegion;
    /** European country site the EU store links open, e.g. "www.nintendo.co.uk" or "www.nintendo.it". */
    euSite: string;
    /** Tried in order when the chosen region has no page for a game. Empty = that region only. */
    fallbackRegions: StoreRegion[];
  };
}

const DEFAULT_SETTINGS: Settings = { nintendoStore: { region: "EU", euSite: "www.nintendo.co.uk", fallbackRegions: ["US"] } };

/** European eShop id from an IGDB link to a European nintendo.com / nintendo.xx game page. */
const EU_PAGE = /nintendo\.(?:com\/(?!us\/)[a-z]{2}-[a-z]{2}|co\.uk|de|fr|it|es|nl|pt|at|be|ch)\/.*-(\d{6,})\.html/i;
const US_STORE = /^https:\/\/www\.nintendo\.com\/us\/store\/products\//;

/** Store page per region for one IGDB game, from Wikidata ids and IGDB links. */
function storePages(g: IgdbGame | undefined, links: LinksCache, settings: Settings): Partial<Record<StoreRegion, string>> {
  if (!g) return {};
  const urls = (g.websites ?? []).map((w) => w.url ?? "");
  const euId = links.eshopEuBySlug[g.slug] ?? urls.map((u) => EU_PAGE.exec(u)?.[1]).find(Boolean);
  const usId = links.eshopUsBySlug[g.slug];
  return {
    EU: euId ? `https://${settings.nintendoStore.euSite}/-/-${euId}.html` : undefined,
    US: urls.find((u) => US_STORE.test(u)) ?? (usId ? `https://www.nintendo.com/us/store/products/${usId}/` : undefined),
  };
}

export interface BuildResult {
  games: Game[];
  report: FetchReport;
}

/**
 * data:build — cache + overrides + history → public/data/games.json and
 * data/fetch-report.json. No network: fast enough to run on every admin save.
 */
export function buildGames(): BuildResult {
  const { igdb, wiki, overridesFile } = loadSelectionInputs();
  if (!igdb.games.length) throw new Error("No IGDB data in data/cache/igdb.json: run `npm run data:fetch` first.");
  const overrides = overridesFile.games;
  const oc = loadOpenCriticCache(PATHS.opencriticCache);
  const links = { ...emptyLinks(), ...readJson<Partial<LinksCache>>(PATHS.linksCache, {}) };
  const settings: Settings = { ...DEFAULT_SETTINGS, ...readJson<Partial<Settings>>(PATHS.settings, {}) };
  const regions = [settings.nintendoStore.region, ...settings.nintendoStore.fallbackRegions.filter((r) => r !== settings.nintendoStore.region)];
  const status = readJson<FetchStatus | null>(PATHS.fetchStatus, null);
  const history = new ExclusivityHistory(PATHS.history);
  const previous = new Map(readJson<GamesFile>(PATHS.games, { generatedAt: "", games: [] }).games.map((g) => [g.id, g]));
  const today = new Date().toISOString().slice(0, 10);

  const { selected, wikiPageById, wikipediaUnmatched, candidates } = selectGames(igdb, wiki, overridesFile);
  const report: FetchReport = {
    generatedAt: new Date().toISOString(),
    fetchedAt: status?.fetchedAt ?? null,
    counts: { candidates: candidates.size, included: 0 },
    exclusivityConflicts: [],
    wikipediaUnmatched,
    opencritic: {
      enabled: status?.opencritic.enabled ?? false,
      searchesUsed: status?.opencritic.searchesUsed ?? 0,
      requestsUsed: status?.opencritic.requestsUsed ?? 0,
      budgetExhausted: status?.opencritic.budgetExhausted ?? false,
      unmatched: [],
      errors: status?.opencritic.errors ?? [],
      keptPrevious: [],
      catalogSize: status?.opencritic.catalogSize ?? oc.catalog?.games.length ?? 0,
    },
    linkErrors: status?.linkErrors ?? [],
    excludedWithoutReviewPage: [],
    unverifiedReviewPage: [],
  };

  const catalog = new Map((oc.catalog?.games ?? []).map((g) => [g.id, g]));
  const kept: Selected[] = [];
  for (const entry of selected) {
    const { game, forced } = entry;
    // Exclusivity: this run's observation, "timed" if the history says it used to be exclusive.
    const manual = overridesFile.manualGames.find((m) => m.id === game.id);
    game.exclusivity = manual?.exclusivity === "timed" ? "timed" : history.peek(game.id, entry.exclusiveNow);
    if (entry.conflict) report.exclusivityConflicts.push({ id: game.id, title: game.title, issue: entry.conflict });

    // --- OpenCritic, from the cache only.
    const released = !!game.firstReleaseDate && game.firstReleaseDate <= today;
    const needsReviewPage = game.kind !== "game" && !forced;
    const cachedMatch = oc.matches[game.id];
    const opencriticId = overrides[game.id]?.opencriticId ?? cachedMatch?.opencriticId ?? null;
    /** "No OpenCritic page" is a real answer only if the game was actually looked up. */
    const checked = overrides[game.id]?.opencriticId !== undefined || cachedMatch !== undefined;
    let scoreKnown = checked && opencriticId === null;
    if (opencriticId && released) {
      const listed = catalog.get(opencriticId);
      const details = oc.games[opencriticId]?.data;
      const value = listed?.topCriticScore ?? details?.topCriticScore;
      if (value !== undefined) {
        scoreKnown = true; // -1 = not enough reviews yet: a real "no score"
        if (value >= 0) game.scores.critic.opencritic = score(Math.round(value), 100, details?.numTopCriticReviews ?? null);
      }
      game.links.opencritic = listed?.url ?? details?.url ?? `https://opencritic.com/game/${opencriticId}`;
    }
    if (!opencriticId && released && checked && !needsReviewPage) report.opencritic.unmatched.push({ id: game.id, title: game.title });
    // Never replace a score with null just because it could not be checked.
    const before = previous.get(game.id);
    if (released && !scoreKnown && before?.scores.critic.opencritic && !game.scores.critic.opencritic) {
      game.scores.critic.opencritic = before.scores.critic.opencritic;
      game.links.opencritic ??= before.links.opencritic;
      report.opencritic.keptPrevious.push({ id: game.id, title: game.title });
    }
    if (needsReviewPage && !opencriticId) {
      const item = { id: game.id, title: game.title, kind: game.kind };
      if (checked) {
        report.excludedWithoutReviewPage.push(item);
        continue;
      }
      report.unverifiedReviewPage.push(item);
    }

    // --- Reference links: own pages, else (DLC / Switch 2 Edition) the base game's, else the last known.
    const page = wikiPageById.get(game.id);
    const own = {
      wikipedia: (entry.slug && links.wikipediaBySlug[entry.slug]) || (page ? wikipediaUrl(page) : undefined),
      nintendoWiki: links.nintendoWikiByTitle[game.title],
    };
    const base = baseOf(entry, candidates);
    const fallback = base
      ? {
          wikipedia: (base.slug && links.wikipediaBySlug[base.slug]) || links.wikipediaByTitle[base.title],
          nintendoWiki: links.nintendoWikiByTitle[base.title],
        }
      : {};
    for (const key of ["wikipedia", "nintendoWiki"] as const) {
      const url = own[key] || fallback[key] || before?.links[key];
      if (url) game.links[key] = url;
    }
    // Nintendo Store: chosen region, then fallback regions; DLC / editions then the base game's page.
    const ownStore = storePages(game.id.startsWith("igdb:") ? candidates.get(Number(game.id.slice(5))) : undefined, links, settings);
    const baseStore = entry.baseId !== undefined ? storePages(candidates.get(entry.baseId), links, settings) : {};
    const store = regions.map((r) => ownStore[r]).find(Boolean) ?? regions.map((r) => baseStore[r]).find(Boolean);
    if (store) game.links.nintendoStore = store;
    kept.push(entry);
  }

  // Dated games by date, then TBA by expected year (unknown year last), then title.
  const sortKey = (g: Game) => g.firstReleaseDate ?? `9999-${g.vagueRelease?.year ?? 9999}`;
  const games = kept
    .map(({ game }) => applyOverride(game, overrides[game.id]))
    .sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : a.title.localeCompare(b.title)));
  report.counts.included = games.length;
  // Date and score histories from data/snapshots/ (ITERATION-3 §3).
  const snapshots = readSnapshots(PATHS.snapshots);
  addHistory(games, snapshots, today);
  // What's new (ITERATION-3 §4).
  const changes: ChangesFile = { generatedAt: report.generatedAt, changes: changesOf(games, snapshots, today) };

  const file: GamesFile = { generatedAt: report.generatedAt, games };
  writeJson(PATHS.games, file);
  writeJson(PATHS.changes, changes);
  writeJson(PATHS.report, report);
  return { games, report };
}

/** Base game of a DLC / Switch 2 Edition: the IGDB parent, else the edition title without its suffix. */
export function baseOf(entry: Selected, candidates: Map<number, IgdbGame>) {
  if (entry.game.kind === "game") return null;
  const g = entry.baseId !== undefined ? candidates.get(entry.baseId) : undefined;
  if (g) return { title: g.name, slug: g.slug as string | undefined };
  const title = baseTitleOfEdition(entry.game.title);
  return title ? { title, slug: undefined } : null;
}
