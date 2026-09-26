/**
 * npm run data:fetch — queries IGDB, Wikipedia/Wikidata, OpenCritic and Nintendo Wiki,
 * saves the raw answers in data/cache/ (ITERATION-3 §1), then runs data:build.
 */
import type { Game } from "../src/types";
import { baseOf, buildGames, type Selected, selectGames } from "./lib/build";
import { emptyLinks, type FetchStatus, type IgdbCache, type LinksCache, readJson, type WikipediaCache, writeJson } from "./lib/cache";
import { env, intEnv, PATHS, requireEnv } from "./lib/env";
import { ExclusivityHistory } from "./lib/exclusivity";
import { HttpError } from "./lib/http";
import { Igdb, type IgdbGame, PLATFORM } from "./lib/igdb";
import { nintendoWikiByTitle, wikidataBySlug, wikipediaByTitle } from "./lib/links";
import { OpenCritic } from "./lib/opencritic";
import { loadOverrides } from "./lib/overrides";
import { snapshotOf, writeSnapshot } from "./lib/snapshots";
import { sameTitle } from "./lib/transform";
import { cleanWikiTitle, fetchSwitch2OnlyGames } from "./lib/wikipedia";

/** Publisher names that make a game first-party (SPEC §3.1). */
const FIRST_PARTY = [
  "Nintendo",
  "Nintendo of America",
  "Nintendo of Europe",
  "The Pokémon Company",
  "The Pokémon Company International",
];

const DAY_MS = 86_400_000;
const today = new Date().toISOString().slice(0, 10);
const daysSince = (iso: string) => Math.floor((Date.parse(today) - Date.parse(iso)) / DAY_MS);
const log = (...args: unknown[]) => console.log("•", ...args);

async function main() {
  const now = new Date().toISOString();
  const overridesFile = loadOverrides(PATHS.overrides);
  const status: FetchStatus = {
    fetchedAt: now,
    opencritic: {
      enabled: false,
      searchesUsed: 0,
      requestsUsed: 0,
      budgetExhausted: false,
      stoppedBecause: null,
      errors: [],
      catalogSize: 0,
    },
    linkErrors: [],
  };

  // --- IGDB: first-party games, their DLC / editions, and forced includes.
  const igdb = await Igdb.connect(requireEnv("TWITCH_CLIENT_ID"), requireEnv("TWITCH_CLIENT_SECRET"));
  const onSwitch = `platforms = (${PLATFORM.SWITCH},${PLATFORM.SWITCH_2})`;
  const companies = await igdb.query<{ id: number; name: string }>(
    "companies",
    `fields id,name; where name = (${FIRST_PARTY.map((n) => JSON.stringify(n)).join(",")}); limit 50;`,
  );
  log(`First-party companies: ${companies.map((c) => `${c.name} (${c.id})`).join(", ")}`);
  const involvements = await igdb.queryAll<{ game: number }>(
    "involved_companies",
    `fields game; where company = (${companies.map((c) => c.id).join(",")}) & publisher = true;`,
  );
  const firstPartyIds = [...new Set(involvements.map((i) => i.game))];
  log(`Games ever published by them: ${firstPartyIds.length}`);

  const candidates = new Map<number, IgdbGame>();
  const add = (games: IgdbGame[]) => games.forEach((g) => candidates.set(g.id, g));
  add(await igdb.gamesWhereIds(firstPartyIds, "id", onSwitch));
  // DLC, expansions and Switch 2 Editions of first-party games (including older base games).
  add(await igdb.gamesWhereIds(firstPartyIds, "parent_game", onSwitch));
  add(await igdb.gamesWhereIds(firstPartyIds, "version_parent", onSwitch));
  log(`First-party Switch / Switch 2 entries (incl. DLC and editions): ${candidates.size}`);

  // --- Wikipedia: third-party Switch 2-only games (SPEC §4.1), matched to IGDB here once.
  const userAgent = `NintendoReleaseTimeline/0.1 (personal project; ${env("WIKI_CONTACT") ?? "no contact set"})`;
  const pages = await fetchSwitch2OnlyGames(userAgent);
  const bySlug = new Map((await igdb.gamesBySlugs(pages.flatMap((w) => w.igdbSlug ?? []))).map((g) => [g.slug, g]));
  const matches: WikipediaCache["matches"] = {};
  for (const page of pages) {
    let hit = page.igdbSlug ? bySlug.get(page.igdbSlug) : undefined;
    if (!hit && !overridesFile.wikipedia[page.title]) {
      // No Wikidata link: title search, accepted only on an exact (normalized) title match.
      const found = await igdb.searchSwitchGame(cleanWikiTitle(page.title));
      if (found && sameTitle(found.name, cleanWikiTitle(page.title))) hit = found;
    }
    matches[page.title] = hit?.id ?? null;
    if (hit) candidates.set(hit.id, hit);
  }
  const matched = Object.values(matches).filter((v) => v !== null).length;
  log(`Wikipedia "Switch 2-only" category: ${pages.length} pages, ${matched} matched on IGDB`);

  // Games named by overrides (forced includes, forced Wikipedia matches) must be in the cache too.
  const named = [
    ...Object.entries(overridesFile.games)
      .filter(([, o]) => o.include === true)
      .map(([id]) => id),
    ...Object.values(overridesFile.wikipedia).flat(),
  ]
    .filter((id) => id.startsWith("igdb:"))
    .map((id) => Number(id.slice(5)))
    .filter((id) => !candidates.has(id));
  if (named.length) add(await igdb.gamesWhereIds([...new Set(named)], "id"));

  const igdbCache: IgdbCache = { fetchedAt: now, firstPartyIds, games: [...candidates.values()] };
  const wikiCache: WikipediaCache = { fetchedAt: now, pages, matches };

  // Base games of DLC / Switch 2 Editions (for fallback links), if not already there.
  let { selected } = selectGames(igdbCache, wikiCache, overridesFile);
  const missingBases = [...new Set(selected.flatMap((s) => (s.baseId !== undefined && !candidates.has(s.baseId) ? [s.baseId] : [])))];
  if (missingBases.length) {
    add(await igdb.gamesWhereIds(missingBases, "id"));
    igdbCache.games = [...candidates.values()];
    ({ selected } = selectGames(igdbCache, wikiCache, overridesFile));
  }
  writeJson(PATHS.igdbCache, igdbCache);
  writeJson(PATHS.wikipediaCache, wikiCache);

  // --- Exclusivity history: a new observation, recorded only here (data:build just reads it).
  const history = new ExclusivityHistory(PATHS.history);
  for (const s of selected) {
    const manual = overridesFile.manualGames.find((m) => m.id === s.game.id);
    if (manual?.exclusivity !== "timed") history.resolve(s.game.id, s.game.title, s.exclusiveNow);
  }
  history.save();

  await fetchOpenCritic(
    selected.map((s) => s.game),
    status,
  );
  await fetchLinks(selected, candidates, userAgent, status);
  writeJson(PATHS.fetchStatus, status);

  // --- Build games.json from what is now in the cache.
  const { games, report } = buildGames();
  log(`Wrote ${games.length} games to public/data/games.json`);
  // Today's picture of every game, for delays and score trends (ITERATION-3 §3).
  writeSnapshot(PATHS.snapshots, snapshotOf(games, today));
  log(`Snapshot saved: data/snapshots/${today}.json`);
  const withLink = (key: "wikipedia" | "nintendoWiki") => games.filter((g) => g.links[key]).length;
  log(`Links: Wikipedia ${withLink("wikipedia")}/${games.length}, Nintendo Wiki ${withLink("nintendoWiki")}/${games.length}`);
  if (status.opencritic.enabled) {
    const { searchesUsed, requestsUsed, stoppedBecause, budgetExhausted } = status.opencritic;
    const note = stoppedBecause ? ` — stopped: ${stoppedBecause}` : budgetExhausted ? " — per-run budget reached, run again later" : "";
    log(`OpenCritic: ${searchesUsed} searches, ${requestsUsed} requests${note}`);
  }
  log("Run `npm run data:validate` for what needs manual data.");

  // Problems must not scroll by unnoticed.
  const { errors, keptPrevious } = report.opencritic;
  if (errors.length || keptPrevious.length || status.linkErrors.length) {
    const bar = "!".repeat(72);
    console.error(`\n${bar}`);
    if (errors.length) {
      const stop = status.opencritic.stoppedBecause;
      console.error(`⚠ OpenCritic: ${errors.length} call(s) failed${stop ? ` — ${stop}` : ""}:`);
      for (const e of errors.slice(0, 5)) console.error(`    ${e}`);
      if (errors.length > 5) console.error(`    … and ${errors.length - 5} more (data/fetch-report.json)`);
    }
    for (const e of status.linkErrors) console.error(`⚠ ${e.slice(0, 200)} — previous links kept`);
    if (keptPrevious.length) {
      console.error(`⚠ ${keptPrevious.length} game(s) kept their previous OpenCritic score instead of being set to null.`);
    }
    console.error(`${bar}\n`);
  }
}

/** OpenCritic: matches and details into data/cache/opencritic.json, freshest games first. */
async function fetchOpenCritic(games: Game[], status: FetchStatus) {
  const apiKey = env("RAPIDAPI_KEY");
  if (!apiKey) {
    log("RAPIDAPI_KEY not set: skipping OpenCritic (the cache, if any, is still used by the build).");
    return;
  }
  status.opencritic.enabled = true;
  const oc = new OpenCritic(apiKey, PATHS.opencriticCache, {
    searches: intEnv("OPENCRITIC_MAX_SEARCHES", 20),
    requests: intEnv("OPENCRITIC_MAX_REQUESTS", 150),
  });
  const fail = (what: string, err: unknown, during: "search" | "request") => {
    status.opencritic.errors.push(`${what}: ${(err as Error).message}`);
    if (!(err instanceof HttpError) || ![401, 403, 429].includes(err.status)) return;
    // Out of quota or bad key: stop calling (the cache keeps serving the build).
    if (err.status === 429 && during === "search") oc.stopSearches("daily search quota reached");
    else oc.goOffline(err.status === 429 ? "RapidAPI daily request quota reached" : `API key rejected (HTTP ${err.status})`);
  };

  try {
    status.opencritic.catalogSize = await oc.loadCatalog(intEnv("OPENCRITIC_CATALOG_DAYS", 3));
    log(`OpenCritic catalog: ${status.opencritic.catalogSize} Switch 2 games`);
  } catch (err) {
    fail("Switch 2 catalog", err, "request");
  }

  // Released games newest first, then upcoming ones soonest first; TBA games have nothing to fetch.
  const priority = (g: Game) => {
    const days = daysSince(g.firstReleaseDate!);
    return days >= 0 ? days : 1_000_000 - days;
  };
  const dated = games.filter((g) => g.firstReleaseDate).sort((a, b) => priority(a) - priority(b));
  for (const game of dated) {
    const released = game.firstReleaseDate! <= today;
    const age = released ? daysSince(game.firstReleaseDate!) : -1;
    let id: number | null | undefined;
    try {
      id = await oc.resolveId(game.id, game.title, age >= 0 && age < 30 ? 3 : 14);
    } catch (err) {
      fail(game.title, err, "search");
    }
    if (!id || !released) continue;
    try {
      await oc.game(id, age < 45 ? 1 : 14);
    } catch (err) {
      fail(game.title, err, "request");
    }
  }
  oc.save();
  Object.assign(status.opencritic, {
    searchesUsed: oc.used.searches,
    requestsUsed: oc.used.requests,
    budgetExhausted: oc.budgetExhausted || oc.offlineReason !== null,
    stoppedBecause: oc.offlineReason ?? oc.searchesStopped,
  });
}

/**
 * Wikipedia / Nintendo Wiki links into data/cache/links.json. Each lookup that
 * succeeds refreshes its keys; a failed one leaves the previous answers in place.
 */
async function fetchLinks(selected: Selected[], candidates: Map<number, IgdbGame>, userAgent: string, status: FetchStatus) {
  const links = { ...emptyLinks(), ...readJson<Partial<LinksCache>>(PATHS.linksCache, {}) };
  const bases = selected.flatMap((s) => baseOf(s, candidates) ?? []);
  const slugs = [...new Set([...selected.flatMap((s) => s.slug ?? []), ...bases.flatMap((b) => b.slug ?? [])])];
  const titles = [...new Set([...selected.map((s) => s.game.title), ...bases.map((b) => b.title)])];
  const baseTitles = [...new Set(bases.map((b) => b.title))];

  const refresh = async (
    key: "wikipediaBySlug" | "wikipediaByTitle" | "nintendoWikiByTitle" | "eshopEuBySlug" | "eshopUsBySlug",
    keys: string[],
    lookup: () => Promise<Map<string, string>>,
    label: string,
  ) => {
    try {
      const found = await lookup();
      for (const k of keys) {
        const url = found.get(k);
        if (url) links[key][k] = url;
        else delete links[key][k];
      }
    } catch (err) {
      status.linkErrors.push(`${label}: ${(err as Error).message}`);
    }
  };
  // One Wikidata query gives the Wikipedia article and both eShop ids.
  let wikidata: Map<string, { wikipedia?: string; eshopEu?: string; eshopUs?: string }> | null = null;
  const fromWikidata = async (field: "wikipedia" | "eshopEu" | "eshopUs") => {
    wikidata ??= await wikidataBySlug(slugs, userAgent);
    return new Map([...wikidata].flatMap(([slug, v]) => (v[field] ? [[slug, v[field]!] as [string, string]] : [])));
  };
  await refresh("wikipediaBySlug", slugs, () => fromWikidata("wikipedia"), "Wikipedia (Wikidata)");
  await refresh("eshopEuBySlug", slugs, () => fromWikidata("eshopEu"), "eShop Europe (Wikidata)");
  await refresh("eshopUsBySlug", slugs, () => fromWikidata("eshopUs"), "eShop US (Wikidata)");
  await refresh("wikipediaByTitle", baseTitles, () => wikipediaByTitle(baseTitles, userAgent), "Wikipedia (titles)");
  await refresh("nintendoWikiByTitle", titles, () => nintendoWikiByTitle(titles, userAgent), "Nintendo Wiki");
  links.fetchedAt = new Date().toISOString();
  writeJson(PATHS.linksCache, links);
}

main().catch((err) => {
  console.error(`✗ ${(err as Error).message}`);
  console.error("games.json was not modified.");
  process.exit(1);
});
