/**
 * npm run data:fetch — builds public/data/games.json from IGDB, OpenCritic,
 * Wikipedia/Wikidata and data/overrides.json (SPEC §3–§5, §9).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Game, GamesFile } from "../src/types";
import { env, intEnv, PATHS, requireEnv } from "./lib/env";
import { ExclusivityHistory } from "./lib/exclusivity";
import { HttpError } from "./lib/http";
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
    opencritic: { enabled: false, searchesUsed: 0, requestsUsed: 0, budgetExhausted: false, unmatched: [], errors: [] },
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
          continue;
        }
        const g = forcedWikiGames.get(Number(id.slice(5)));
        if (g) {
          wikiIds.add(g.id);
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

    if (oc && game.firstReleaseDate) {
      try {
        const age = released ? daysSince(game.firstReleaseDate) : -1;
        if (opencriticId === null) {
          const resolved = await oc.resolveId(game.id, game.title, age >= 0 && age < 30 ? 3 : 14);
          opencriticId = resolved ?? null;
          checked = resolved !== undefined;
        }
        if (opencriticId && released) {
          const data = await oc.game(opencriticId, age < 45 ? 1 : 14);
          if (data && data.topCriticScore >= 0) {
            game.scores.critic.opencritic = score(Math.round(data.topCriticScore), 100, data.numTopCriticReviews);
          }
          game.links.opencritic = data?.url ?? `https://opencritic.com/game/${opencriticId}`;
        }
        // DLC / editions without a page are reported as excluded below instead.
        if (!opencriticId && released && checked && !needsReviewPage) {
          report.opencritic.unmatched.push({ id: game.id, title: game.title });
        }
      } catch (err) {
        report.opencritic.errors.push(`${game.title}: ${(err as Error).message}`);
        // Out of daily quota or bad key: stop calling, but keep serving what is cached.
        if (err instanceof HttpError && (err.status === 429 || err.status === 401 || err.status === 403)) oc.goOffline();
      }
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
      budgetExhausted: oc.budgetExhausted,
    });
  }

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
  if (oc) log(`OpenCritic: ${oc.used.searches} searches, ${oc.used.requests} requests${report.opencritic.budgetExhausted ? " — budget reached, run again tomorrow" : ""}`);
  log("Run `npm run data:validate` for what needs manual data.");
}

main().catch((err) => {
  console.error(`✗ ${(err as Error).message}`);
  console.error("games.json was not modified.");
  process.exit(1);
});
