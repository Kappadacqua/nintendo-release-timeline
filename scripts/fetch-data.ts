/**
 * npm run data:fetch — builds public/data/games.json from IGDB, OpenCritic,
 * Wikipedia/Wikidata and data/overrides.json (SPEC §3–§5, §9).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Game, GamesFile } from "../src/types";
import { env, intEnv, PATHS, requireEnv } from "./lib/env";
import { ExclusivityHistory } from "./lib/exclusivity";
import { HttpError } from "./lib/http";
import { baseTitleOfEdition, nintendoWikiByTitle, wikipediaBySlug, wikipediaByTitle, wikipediaUrl } from "./lib/links";
import { Igdb, type IgdbGame, PLATFORM } from "./lib/igdb";
import { OpenCritic } from "./lib/opencritic";
import { applyOverride, loadOverrides, manualToGame, score } from "./lib/overrides";
import type { FetchReport } from "./lib/report";
import {
  igdbExclusive,
  inDateRange,
  isExcludedType,
  isOnSwitch,
  kindOf,
  releaseInfo,
  sameTitle,
  toGame,
} from "./lib/transform";
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
  const overridesFile = loadOverrides(PATHS.overrides);
  const overrides = overridesFile.games;
  const report: FetchReport = {
    generatedAt: new Date().toISOString(),
    counts: { candidates: 0, included: 0 },
    exclusivityConflicts: [],
    wikipediaUnmatched: [],
    opencritic: {
      enabled: false,
      searchesUsed: 0,
      requestsUsed: 0,
      budgetExhausted: false,
      unmatched: [],
      errors: [],
      keptPrevious: [],
      catalogSize: 0,
    },
    linkErrors: [],
    excludedWithoutReviewPage: [],
    unverifiedReviewPage: [],
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

  // --- Wikipedia: third-party Switch 2-only games (SPEC §4.1).
  const userAgent = `NintendoReleaseTimeline/0.1 (personal project; ${env("WIKI_CONTACT") ?? "no contact set"})`;
  const wikiGames = await fetchSwitch2OnlyGames(userAgent);
  const wikiIds = new Set<number>();
  /** Wikipedia page title per game id ("igdb:…" / "manual:…"), from the category match. */
  const wikiPageById = new Map<string, string>();
  /** "manual:…" ids named by a Wikipedia page through overrides.wikipedia. */
  const wikiManualIds = new Set<string>();
  const bySlug = new Map((await igdb.gamesBySlugs(wikiGames.flatMap((w) => w.igdbSlug ?? []))).map((g) => [g.slug, g]));
  const forcedWikiIgdb = Object.values(overridesFile.wikipedia).flat().filter((id) => id.startsWith("igdb:"));
  const forcedWikiGames = new Map(
    (forcedWikiIgdb.length ? await igdb.gamesWhereIds(forcedWikiIgdb.map((id) => Number(id.slice(5))), "id") : []).map((g) => [g.id, g]),
  );
  for (const w of wikiGames) {
    const forcedMatch = overridesFile.wikipedia[w.title];
    if (forcedMatch) {
      for (const id of forcedMatch) {
        if (id.startsWith("manual:")) {
          wikiManualIds.add(id);
          wikiPageById.set(id, w.title);
          continue;
        }
        const g = forcedWikiGames.get(Number(id.slice(5)));
        if (g) {
          wikiIds.add(g.id);
          wikiPageById.set(`igdb:${g.id}`, w.title);
          candidates.set(g.id, g);
        }
      }
      continue;
    }
    let hit = w.igdbSlug ? bySlug.get(w.igdbSlug) : undefined;
    if (!hit) {
      // No Wikidata link: title search, accepted only on an exact (normalized) title match.
      const found = await igdb.searchSwitchGame(cleanWikiTitle(w.title));
      if (found && sameTitle(found.name, cleanWikiTitle(w.title))) hit = found;
    }
    if (!hit) {
      report.wikipediaUnmatched.push({ title: w.title, wikidataId: w.wikidataId });
      continue;
    }
    wikiIds.add(hit.id);
    wikiPageById.set(`igdb:${hit.id}`, w.title);
    candidates.set(hit.id, hit);
  }
  log(`Wikipedia "Switch 2-only" category: ${wikiGames.length} pages, ${wikiIds.size} matched on IGDB`);

  const forcedIds = Object.entries(overrides)
    .filter(([id, o]) => o.include === true && id.startsWith("igdb:"))
    .map(([id]) => Number(id.slice(5)))
    .filter((id) => !candidates.has(id));
  if (forcedIds.length) add(await igdb.gamesWhereIds(forcedIds, "id"));
  report.counts.candidates = candidates.size;

  // --- Perimeter (SPEC §3).
  const history = new ExclusivityHistory(PATHS.history);
  const firstParty = new Set(firstPartyIds);
  let games: { game: Game; forced: boolean }[] = [];
  const slugById = new Map<string, string>();
  /** DLC / Switch 2 Edition → IGDB id of the base game (for fallback links). */
  const baseIdById = new Map<string, number>();

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
    const exIgdb = igdbExclusive(g);
    const exWiki = wikiIds.has(g.id);
    if (exWiki && !exIgdb) {
      report.exclusivityConflicts.push({ id: game.id, title: game.title, issue: "In the Wikipedia Switch 2-only category, but IGDB lists other platforms" });
    } else if (!exWiki && exIgdb && kindOf(g) === "game" && (g.platforms ?? []).every((p) => p === PLATFORM.SWITCH_2)) {
      report.exclusivityConflicts.push({ id: game.id, title: game.title, issue: "Switch 2-only on IGDB, but missing from the Wikipedia category" });
    }
    game.exclusivity = history.resolve(game.id, game.title, exIgdb || exWiki);
    games.push({ game, forced });
    slugById.set(game.id, g.slug);
    const baseId = g.parent_game?.id ?? g.version_parent;
    if (game.kind !== "game" && baseId) baseIdById.set(game.id, baseId);
  }

  // Hand-written games missing from IGDB: always shown unless "include": false.
  for (const m of overridesFile.manualGames) {
    if (overrides[m.id]?.include === false) continue;
    const game = manualToGame(m);
    const exclusive = m.exclusivity === "exclusive" || (m.exclusivity === undefined && wikiManualIds.has(m.id));
    game.exclusivity = m.exclusivity === "timed" ? "timed" : history.resolve(game.id, game.title, exclusive);
    games.push({ game, forced: true });
  }

  // --- OpenCritic (optional): freshest games first, so a small daily budget goes where it matters.
  const apiKey = env("RAPIDAPI_KEY");
  const oc = apiKey
    ? new OpenCritic(apiKey, PATHS.opencriticCache, {
        searches: intEnv("OPENCRITIC_MAX_SEARCHES", 20),
        requests: intEnv("OPENCRITIC_MAX_REQUESTS", 150),
      })
    : null;
  report.opencritic.enabled = !!oc;
  if (!oc) log("RAPIDAPI_KEY not set: skipping OpenCritic (scores N/D, DLC/editions not verified).");

  // Last games.json: a score OpenCritic could not confirm this run is kept, never replaced by null.
  const previous = new Map<string, Game>();
  if (existsSync(PATHS.games)) {
    for (const g of (JSON.parse(readFileSync(PATHS.games, "utf8")) as GamesFile).games) previous.set(g.id, g);
  }
  const failOpenCritic = (what: string, err: unknown, during: "search" | "request") => {
    report.opencritic.errors.push(`${what}: ${(err as Error).message}`);
    if (!(err instanceof HttpError) || ![401, 403, 429].includes(err.status)) return;
    // Out of quota or bad key: stop calling, but keep serving what is cached.
    if (err.status === 429 && during === "search") oc?.stopSearches("daily search quota reached");
    else oc?.goOffline(err.status === 429 ? "RapidAPI daily request quota reached" : `API key rejected (HTTP ${err.status})`);
  };

  if (oc) {
    try {
      report.opencritic.catalogSize = await oc.loadCatalog(intEnv("OPENCRITIC_CATALOG_DAYS", 3));
      log(`OpenCritic catalog: ${report.opencritic.catalogSize} Switch 2 games`);
    } catch (err) {
      failOpenCritic("Switch 2 catalog", err, "request");
    }
  }

  // Released games newest first, then upcoming ones soonest first, then TBA.
  const priority = ({ game }: (typeof games)[number]) => {
    const d = game.firstReleaseDate;
    if (!d) return Number.MAX_SAFE_INTEGER;
    const days = daysSince(d);
    return days >= 0 ? days : 1_000_000 - days;
  };
  games.sort((a, b) => priority(a) - priority(b));
  const kept: typeof games = [];

  for (const entry of games) {
    const { game, forced } = entry;
    const released = !!game.firstReleaseDate && game.firstReleaseDate <= today;
    const needsReviewPage = game.kind !== "game" && !forced;
    let opencriticId: number | null = overrides[game.id]?.opencriticId ?? null;
    /** Whether "no OpenCritic page" is a real answer rather than an unchecked game. */
    let checked = opencriticId !== null;
    /** Whether the OpenCritic score (or its absence) is a real answer from this run. */
    let scoreKnown = false;

    if (oc && game.firstReleaseDate) {
      const age = released ? daysSince(game.firstReleaseDate) : -1;
      try {
        if (opencriticId === null) {
          const resolved = await oc.resolveId(game.id, game.title, age >= 0 && age < 30 ? 3 : 14);
          opencriticId = resolved ?? null;
          checked = resolved !== undefined;
          scoreKnown = resolved === null; // definitely no page, so no score
        }
      } catch (err) {
        failOpenCritic(game.title, err, "search");
      }

      if (opencriticId && released) {
        // Score from the catalog (refreshed for all games at once), top-critic count from the details.
        const listed = oc.catalogEntry(opencriticId);
        let details = null;
        try {
          details = await oc.game(opencriticId, age < 45 ? 1 : 14);
        } catch (err) {
          failOpenCritic(game.title, err, "request");
        }
        const value = listed?.topCriticScore ?? details?.topCriticScore;
        if (value !== undefined) {
          scoreKnown = true; // -1 = not enough reviews yet: a real "no score"
          if (value >= 0) game.scores.critic.opencritic = score(Math.round(value), 100, details?.numTopCriticReviews ?? null);
        }
        game.links.opencritic = listed?.url ?? details?.url ?? `https://opencritic.com/game/${opencriticId}`;
      }
      // DLC / editions without a page are reported as excluded below instead.
      if (!opencriticId && released && checked && !needsReviewPage) {
        report.opencritic.unmatched.push({ id: game.id, title: game.title });
      }
    }

    const before = previous.get(game.id)?.scores.critic.opencritic;
    if (released && !scoreKnown && before && !game.scores.critic.opencritic) {
      game.scores.critic.opencritic = before;
      game.links.opencritic ??= previous.get(game.id)?.links.opencritic;
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
    kept.push(entry);
  }
  games = kept;

  if (oc) {
    oc.save();
    Object.assign(report.opencritic, {
      searchesUsed: oc.used.searches,
      requestsUsed: oc.used.requests,
      budgetExhausted: oc.budgetExhausted || oc.offlineReason !== null,
    });
  }

  // --- Wikipedia and Nintendo Wiki links (ITERATION-2 §7). On failure the previous links stay.
  const keepPreviousLinks = (key: "wikipedia" | "nintendoWiki") => {
    for (const { game } of games) {
      const before = previous.get(game.id)?.links[key];
      if (before) game.links[key] ??= before;
    }
  };
  try {
    const bySlug = await wikipediaBySlug([...new Set(slugById.values())], userAgent);
    for (const { game } of games) {
      const slug = slugById.get(game.id);
      const page = wikiPageById.get(game.id);
      const url = (slug && bySlug.get(slug)) || (page && wikipediaUrl(page));
      if (url) game.links.wikipedia = url;
    }
  } catch (err) {
    report.linkErrors.push(`Wikipedia (Wikidata): ${(err as Error).message}`);
    keepPreviousLinks("wikipedia");
  }
  try {
    const byTitle = await nintendoWikiByTitle(games.map(({ game }) => game.title), userAgent);
    for (const { game } of games) {
      const url = byTitle.get(game.title);
      if (url) game.links.nintendoWiki = url;
    }
  } catch (err) {
    report.linkErrors.push(`Nintendo Wiki: ${(err as Error).message}`);
    keepPreviousLinks("nintendoWiki");
  }
  // DLC and Switch 2 Editions without a page of their own: the base game's pages.
  try {
    const lacking = games.filter(({ game }) => game.kind !== "game" && (!game.links.wikipedia || !game.links.nintendoWiki));
    const missingBaseIds = [...new Set(lacking.flatMap(({ game }) => baseIdById.get(game.id) ?? []))].filter((id) => !candidates.has(id));
    const bases = new Map([...candidates.values()].map((g) => [g.id, g]));
    if (missingBaseIds.length) for (const g of await igdb.gamesWhereIds(missingBaseIds, "id")) bases.set(g.id, g);
    const baseOf = (game: Game) => {
      const g = bases.get(baseIdById.get(game.id) ?? -1);
      return g ? { title: g.name, slug: g.slug as string | undefined } : { title: baseTitleOfEdition(game.title), slug: undefined };
    };
    const info = lacking.map(({ game }) => ({ game, base: baseOf(game) })).filter((x) => x.base.title);
    const baseSlugs = [...new Set(info.flatMap((x) => x.base.slug ?? []))];
    const baseTitles = [...new Set(info.map((x) => x.base.title!))];
    const [wikiBySlug, wikiByTitle, nwikiByTitle] = await Promise.all([
      wikipediaBySlug(baseSlugs, userAgent),
      wikipediaByTitle(baseTitles, userAgent),
      nintendoWikiByTitle(baseTitles, userAgent),
    ]);
    for (const { game, base } of info) {
      game.links.wikipedia ??= (base.slug && wikiBySlug.get(base.slug)) || wikiByTitle.get(base.title!);
      game.links.nintendoWiki ??= nwikiByTitle.get(base.title!);
      if (!game.links.wikipedia) delete game.links.wikipedia;
      if (!game.links.nintendoWiki) delete game.links.nintendoWiki;
    }
  } catch (err) {
    report.linkErrors.push(`Base-game links: ${(err as Error).message}`);
  }
  const withLink = (key: "wikipedia" | "nintendoWiki") => games.filter(({ game }) => game.links[key]).length;
  log(`Links: Wikipedia ${withLink("wikipedia")}/${games.length}, Nintendo Wiki ${withLink("nintendoWiki")}/${games.length}`);

  // --- Overrides and output.
  // Dated games by date, then TBA by expected year (unknown year last), then title.
  const sortKey = (g: Game) => g.firstReleaseDate ?? `9999-${g.vagueRelease?.year ?? 9999}`;
  const final = games
    .map(({ game }) => applyOverride(game, overrides[game.id]))
    .sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : a.title.localeCompare(b.title)));
  report.counts.included = final.length;

  const file: GamesFile = { generatedAt: report.generatedAt, games: final };
  mkdirSync(dirname(PATHS.games), { recursive: true });
  writeFileSync(PATHS.games, `${JSON.stringify(file, null, 2)}\n`);
  history.save();
  writeFileSync(PATHS.report, `${JSON.stringify(report, null, 2)}\n`);

  log(`Wrote ${final.length} games to public/data/games.json`);
  if (oc) {
    const stop = oc.offlineReason ?? oc.searchesStopped;
    const note = stop ? ` — stopped: ${stop}` : oc.budgetExhausted ? " — per-run budget reached, run again later" : "";
    log(`OpenCritic: ${oc.used.searches} searches, ${oc.used.requests} requests${note}`);
  }
  log("Run `npm run data:validate` for what needs manual data.");

  // Problems must not scroll by unnoticed.
  const { errors, keptPrevious } = report.opencritic;
  if (errors.length || keptPrevious.length || report.linkErrors.length) {
    const bar = "!".repeat(72);
    console.error(`\n${bar}`);
    if (errors.length) {
      const stop = oc?.offlineReason ?? oc?.searchesStopped;
      console.error(`⚠ OpenCritic: ${errors.length} call(s) failed${stop ? ` — ${stop}` : ""}:`);
      for (const e of errors.slice(0, 5)) console.error(`    ${e}`);
      if (errors.length > 5) console.error(`    … and ${errors.length - 5} more (data/fetch-report.json)`);
    }
    for (const e of report.linkErrors) console.error(`⚠ ${e.slice(0, 200)} — previous links kept`);
    if (keptPrevious.length) {
      console.error(`⚠ ${keptPrevious.length} game(s) kept their previous OpenCritic score instead of being set to null.`);
    }
    console.error(`${bar}\n`);
  }
}

main().catch((err) => {
  console.error(`✗ ${(err as Error).message}`);
  console.error("games.json was not modified.");
  process.exit(1);
});
