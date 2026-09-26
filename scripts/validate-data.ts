/**
 * npm run data:validate — lists what needs manual work in data/overrides.json:
 * missing Metacritic / Backloggd values, exclusivity conflicts, unmatched games.
 *
 *   --stubs   also print an overrides snippet for the missing manual scores
 */
import { existsSync, readFileSync } from "node:fs";
import type { Game, GamesFile } from "../src/types";
import { PATHS } from "./lib/env";
import { loadOverrides } from "./lib/overrides";
import type { FetchReport } from "./lib/report";

const today = new Date().toISOString().slice(0, 10);
const bold = (s: string) => (process.stdout.isTTY ? `\x1b[1m${s}\x1b[0m` : s);
const dim = (s: string) => (process.stdout.isTTY ? `\x1b[2m${s}\x1b[0m` : s);

let problems = 0;
function section(title: string, lines: string[], hint?: string) {
  if (!lines.length) return;
  problems += lines.length;
  console.log(`\n${bold(`${title} (${lines.length})`)}`);
  if (hint) console.log(dim(`  ${hint}`));
  for (const line of lines) console.log(`  - ${line}`);
}

const label = (g: Pick<Game, "id" | "title">) => `${g.title} ${dim(`[${g.id}]`)}`;

const { games } = JSON.parse(readFileSync(PATHS.games, "utf8")) as GamesFile;
const overrides = loadOverrides(PATHS.overrides).games;
const report: FetchReport | null = existsSync(PATHS.report)
  ? (JSON.parse(readFileSync(PATHS.report, "utf8")) as FetchReport)
  : null;

console.log(`${games.length} games in games.json${report ? `, fetched ${report.generatedAt.slice(0, 16).replace("T", " ")}` : ""}`);
if (!report) console.log(dim("No data/fetch-report.json: run `npm run data:fetch` for conflict checks."));

// --- Manual scores (SPEC §4): only released games can have them.
const released = games.filter((g) => g.firstReleaseDate && g.firstReleaseDate <= today);
const missing = released
  .map((g) => {
    const gaps = [
      !g.scores.critic.metacritic && "Metacritic critic",
      !g.scores.user.metacritic && "Metacritic user",
      !g.scores.user.backloggd && "Backloggd",
    ].filter(Boolean) as string[];
    return { g, gaps };
  })
  .filter((m) => m.gaps.length);
section(
  "Released games missing Metacritic or Backloggd",
  missing.map(({ g, gaps }) => `${label(g)} ${dim(g.firstReleaseDate!)} — ${gaps.join(", ")}`),
  "Add them under games.<id>.metacritic / .backloggd in data/overrides.json.",
);

// --- Reference links (ITERATION-2 §7): overridable with links.wikipedia / links.nintendoWiki.
const noLinks = games
  .map((g) => ({ g, gaps: [!g.links.wikipedia && "Wikipedia", !g.links.nintendoWiki && "Nintendo Wiki"].filter(Boolean) as string[] }))
  .filter((m) => m.gaps.length);
section(
  "Games without a Wikipedia or Nintendo Wiki link",
  noLinks.map(({ g, gaps }) => `${label(g)} — ${gaps.join(", ")}`),
  "Add them under games.<id>.links.wikipedia / links.nintendoWiki in data/overrides.json.",
);

// --- From the last fetch.
if (report) {
  section(
    "Exclusivity conflicts (Wikipedia vs IGDB)",
    report.exclusivityConflicts
      .filter((c) => overrides[c.id]?.exclusivity === undefined) // already decided by hand
      .map((c) => `${label(c)} — ${c.issue}`),
    'Decide with "exclusivity": "exclusive" | "timed" | null in data/overrides.json.',
  );
  section(
    "Wikipedia category entries not found on IGDB",
    report.wikipediaUnmatched.map((w) => `${w.title}${w.wikidataId ? dim(` (${w.wikidataId})`) : ""}`),
    'Find the IGDB id and add it with "include": true.',
  );
  section(
    "Released games without an OpenCritic match",
    report.opencritic.unmatched.map(label),
    'If the page exists, set "opencriticId" (the number in opencritic.com/game/<id>/…).',
  );
  section(
    "DLC / Switch 2 Editions excluded (no OpenCritic page)",
    report.excludedWithoutReviewPage.map((x) => `${label(x)} ${dim(x.kind)}`),
    'Add "include": true (or "opencriticId") to show them anyway.',
  );
  section(
    "DLC / Switch 2 Editions not verified against OpenCritic",
    report.unverifiedReviewPage.map((x) => `${label(x)} ${dim(x.kind)}`),
    report.opencritic.enabled
      ? "OpenCritic budget ran out; they will be checked on the next runs."
      : "RAPIDAPI_KEY is not set, so they were kept without the check.",
  );
  section("OpenCritic errors", report.opencritic.errors);
  section("Wikipedia / Nintendo Wiki errors", report.linkErrors ?? []);
  section(
    "OpenCritic scores kept from the previous fetch",
    (report.opencritic.keptPrevious ?? []).map(label),
    "OpenCritic could not be checked for these; the next successful fetch refreshes them.",
  );
  if (report.opencritic.budgetExhausted) {
    console.log(dim("\nOpenCritic daily budget reached during the last fetch: some scores are stale or missing."));
  }
}

// --- Overrides that point nowhere.
const ids = new Set(games.map((g) => g.id));
section(
  "Overrides for games not in games.json",
  Object.entries(overrides)
    .filter(([id, o]) => !ids.has(id) && o.include !== false)
    .map(([id]) => id),
  "Typo in the id, or the game fell out of the perimeter (date, platform, type).",
);

// --- TBA zone, worth a glance for stale IGDB entries.
const tba = games.filter((g) => !g.firstReleaseDate);
if (tba.length) {
  console.log(`\n${bold(`TBA zone (${tba.length})`)} ${dim("— hide stale entries with \"include\": false")}`);
  for (const g of tba) console.log(`  - ${label(g)} ${dim(g.vagueRelease?.label ?? "TBA")}`);
}

if (process.argv.includes("--stubs") && missing.length) {
  // Only the blocks with gaps, pre-filled with what overrides.json already has.
  const stubs: Record<string, object> = {};
  for (const { g, gaps } of missing) {
    const o = overrides[g.id] ?? {};
    const stub: Record<string, unknown> = { _title: g.title };
    if (gaps.some((x) => x.startsWith("Metacritic"))) {
      stub.metacritic = { critic: null, criticCount: null, user: null, userCount: null, ...o.metacritic };
    }
    if (gaps.includes("Backloggd")) stub.backloggd = { rating: null, count: null, ...o.backloggd };
    stubs[g.id] = stub;
  }
  console.log(`\n${bold("Overrides stubs")} ${dim("(fill in the numbers and merge into data/overrides.json)")}`);
  console.log(JSON.stringify(stubs, null, 2));
}

console.log(problems ? `\n${problems} item(s) to review.` : "\nNothing to review.");
