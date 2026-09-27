/**
 * npm run data:fetch-studios — Nintendo's first-party studios from Nintendo Wiki
 * (Category:First_party_developers), with categories and active state, saved in
 * data/cache/studios.json. Public MediaWiki API only: no quotas.
 * Manual fixes go in data/studios-overrides.json. If the category has fewer studios than the
 * saved cache, the cache is kept: run `npm run data:fetch-studios -- --force` to accept them.
 */
import { readJson, writeJson } from "./lib/cache";
import { env, PATHS } from "./lib/env";
import { fetchFirstPartyStudios, loadStudiosOverrides, type StudiosCache } from "./lib/fandom";

const log = (...args: unknown[]) => console.log("•", ...args);

async function main() {
  const userAgent = `NintendoReleaseTimeline/0.1 (personal project; ${env("WIKI_CONTACT") ?? "no contact set"})`;
  const studios = await fetchFirstPartyStudios(userAgent);
  if (!studios.length) throw new Error("No pages in Category:First_party_developers.");
  const previous = readJson<StudiosCache | null>(PATHS.studiosCache, null)?.studios ?? [];
  if (studios.length < previous.length && !process.argv.includes("--force")) {
    const gone = previous.filter((p) => !studios.some((s) => s.title === p.title)).map((p) => p.title);
    throw new Error(
      `${studios.length} studios, ${previous.length} in the saved cache (missing: ${gone.join(", ")}). ` +
        "Cache kept; run `npm run data:fetch-studios -- --force` to save the smaller list.",
    );
  }
  const cache: StudiosCache = {
    fetchedAt: new Date().toISOString(),
    source: "https://nintendo.fandom.com/wiki/Category:First_party_developers",
    studios,
  };
  writeJson(PATHS.studiosCache, cache);

  const overrides = loadStudiosOverrides();
  // Keys outside the category are partner / third-party aliases, unless they force "active".
  const unknown = Object.keys(overrides).filter((t) => overrides[t].active !== undefined && !studios.some((s) => s.title === t));
  // Uncertain cases already decided in the overrides file are not doubts any more.
  const open = studios.filter((s) => s.uncertain && overrides[s.title]?.active === undefined);
  const active = studios.filter((s) => overrides[s.title]?.active ?? s.active).length;
  log(`${studios.length} studios: ${studios.filter((s) => s.active).length} active by categories, ${studios.filter((s) => s.uncertain).length} uncertain`);
  log(`After overrides: ${active} active, ${open.length} still uncertain${open.length ? ` (${open.map((s) => s.title).join(", ")})` : ""}`);
  if (unknown.length) console.error(`⚠ Overrides for pages not in the category: ${unknown.join(", ")}`);
  log("Saved data/cache/studios.json.");
}

main().catch((err) => {
  console.error(`✗ ${(err as Error).message}`);
  process.exit(1);
});
