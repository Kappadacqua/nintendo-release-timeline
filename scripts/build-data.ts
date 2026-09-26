/**
 * npm run data:build — data/cache/ + data/overrides.json + history → public/data/games.json.
 * No network calls (ITERATION-3 §1): it is what the admin panel runs on every save.
 */
import { buildGames } from "./lib/build";

const started = performance.now();
try {
  const { games, report } = buildGames();
  const ms = Math.round(performance.now() - started);
  console.log(`• Wrote ${games.length} games to public/data/games.json in ${ms} ms (data fetched ${report.fetchedAt?.slice(0, 16).replace("T", " ") ?? "never"})`);
} catch (err) {
  console.error(`✗ ${(err as Error).message}`);
  process.exit(1);
}
