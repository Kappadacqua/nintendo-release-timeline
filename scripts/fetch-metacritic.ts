/**
 * npm run data:fetch-metacritic — reads the Metacritic page of the released games already
 * in the perimeter (from the IGDB / Wikipedia cache of the last data:fetch) into
 * data/cache/metacritic.json, then runs data:build and refreshes today's snapshot.
 * Never adds games: Metacritic only enriches the list.
 */
import { buildGames, loadSelectionInputs, selectGames } from "./lib/build";
import { type FetchStatus, readJson, writeJson } from "./lib/cache";
import { PATHS } from "./lib/env";
import { emptyMetacriticStatus, fetchMetacritic } from "./lib/metacritic";
import { snapshotOf, writeSnapshot } from "./lib/snapshots";

const log = (...args: unknown[]) => console.log("•", ...args);

async function main() {
  const { igdb, wiki, overridesFile } = loadSelectionInputs();
  if (!igdb.games.length) throw new Error("No IGDB data in data/cache/igdb.json: run `npm run data:fetch` first.");
  const { selected } = selectGames(igdb, wiki, overridesFile);

  const metacritic = emptyMetacriticStatus();
  await fetchMetacritic(selected.map((s) => s.game), overridesFile, PATHS.metacriticCache, metacritic, log);
  // Keep the rest of the last data:fetch status; only the Metacritic part is new.
  const status = readJson<FetchStatus | null>(PATHS.fetchStatus, null);
  if (status) writeJson(PATHS.fetchStatus, { ...status, metacritic });

  const { games, report } = buildGames();
  log(`Wrote ${games.length} games to public/data/games.json`);
  const today = new Date().toISOString().slice(0, 10);
  writeSnapshot(PATHS.snapshots, snapshotOf(games, today));
  log(`Snapshot saved: data/snapshots/${today}.json`);
  const mc = report.metacritic!;
  log(`Metacritic: ${mc.notFound.length} not found, ${mc.mismatched.length} another game, ${mc.unchecked} not checked yet — details in npm run data:validate`);
  if (metacritic.errors.length) {
    console.error(`⚠ Metacritic: ${metacritic.errors.length} page(s) failed${metacritic.stoppedBecause ? ` — ${metacritic.stoppedBecause}` : ""} (previous scores kept)`);
    for (const e of metacritic.errors.slice(0, 5)) console.error(`    ${e}`);
  }
}

main().catch((err) => {
  console.error(`✗ ${(err as Error).message}`);
  process.exit(1);
});
