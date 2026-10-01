/**
 * npm run data:validate — lists what needs manual work in data/overrides.json:
 * missing Metacritic / Backloggd values, Metacritic pages not found, exclusivity conflicts,
 * unmatched games.
 *
 *   --stubs   also print an overrides snippet for the missing manual scores
 *   --todo    write data/manual-todo.md: released games without a link, a URL field each
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { Game, GamesFile } from "../src/types";
import { localToday } from "./lib/build";
import { PATHS } from "./lib/env";
import { type GameGaps, gapsOf } from "./lib/gaps";
import { manualTodo } from "./lib/manual-todo";
import { loadMetacriticCache } from "./lib/metacritic";
import { loadOverrides } from "./lib/overrides";
import type { FetchReport } from "./lib/report";

const today = localToday();
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

// --- Missing scores and links (SPEC §4), with the reason. Sources marked
// "absent": { "<source>": { "status": "none" } } in the overrides are left out, and so is the TBA zone.
const gaps = gapsOf(games, overrides, loadMetacriticCache(PATHS.metacriticCache), today);
const gapList = (g: GameGaps) => g.gaps.map((x) => `${x.source} ${dim(`(${x.state})`)}`).join(", ");
section(
  "Released games missing a Metacritic score",
  gaps.scores.map((g) => `${label(g)} ${dim(g.date ?? "")} — ${gapList(g)}`),
  "not looked up: run data:fetch-metacritic · no page found: set links.metacritic in the admin panel · tbd: too few reviews yet, wait · none for real: \"absent\": { \"metacritic\": { \"status\": \"none\" } } in data/overrides.json.",
);
section(
  "Games without a Wikipedia, Nintendo Wiki or Nintendo Store link",
  gaps.links.map((g) => `${label(g)} — ${g.gaps.map((x) => x.source).join(", ")}`),
  'Add them in the admin panel (npm run dev → /admin) or under games.<id>.links in data/overrides.json; no page at all: "absent": { "wikipedia": { "status": "none" } }.',
);
if (process.argv.includes("--todo")) {
  const path = PATHS.manualTodo;
  const released = gaps.links.filter((g) => g.date! <= today);
  writeFileSync(path, manualTodo(released, today, existsSync(path) ? readFileSync(path, "utf8") : ""));
  console.log(dim(`\nWrote data/manual-todo.md (${released.length} released game(s) without a link).`));
}
if (gaps.backloggdMissing) {
  console.log(dim(`\nBackloggd is optional and entered by hand (backloggd.com blocks scripts with a bot challenge): ${gaps.backloggdMissing} released game(s) without a value, not counted. Admin panel, filter "Backloggd".`));
}
const none = Object.entries(gaps.confirmedNone);
if (none.length) console.log(dim(`\nConfirmed absent (data/overrides.json, or a page Metacritic removed), not listed: ${none.map(([k, n]) => `${k} ${n}`).join(", ")}.`));

// --- Free updates (data/free-updates.json): the cover comes from IGDB.
section(
  "Free updates without a cover",
  games.filter((g) => g.kind === "free-update" && g.coverUrl.includes("covers/placeholder")).map(label),
  "Run `npm run data:fetch-free-updates`, or set coverUrl under games.<id> in data/overrides.json.",
);

// --- From the last fetch.
if (report) {
  if (report.freeUpdates?.duplicates.length) {
    console.log(`\n${bold("Free updates merged into an existing card")} ${dim("— not an error")}`);
    for (const d of report.freeUpdates.duplicates) console.log(`  - ${d.title} ${dim(`→ ${d.of}`)}`);
  }
  section(
    "Free updates left out: invalid entry",
    report.freeUpdates?.invalid ?? [],
    "Fix the entry in data/free-updates.json: a title and dates written as YYYY-MM-DD.",
  );
  section(
    "Free updates not found on IGDB",
    report.freeUpdates?.notOnIgdb ?? [],
    "Check the title in data/free-updates.json, then run `npm run data:fetch-free-updates`.",
  );
  section(
    "Free updates matched on IGDB by release year only",
    report.freeUpdates?.approximate ?? [],
    'Check cover and summary on the card; if it is another game, set "igdbId" on the entry in data/free-updates.json and run `npm run data:fetch-free-updates`.',
  );
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
  section(
    "Studios cache missing or empty",
    report.studiosCacheEmpty ? ["data/cache/studios.json has no studios: Nintendo's studios were built as partners, without Nintendo Wiki links."] : [],
    "Run `npm run data:fetch-studios` (or restore the file from git), then `npm run data:build`.",
  );
  section(
    "First-party games attributed to no studio",
    (report.studiosUnmatched ?? []).map((u) => `${u.developer || "(no IGDB developer)"} ${dim(`— ${u.titles.join(", ")}`)}`),
    'Add the IGDB name under "igdbNames" of the studio in data/studios-overrides.json, or set "developer" in the game overrides.',
  );
  section(
    "Names claimed by two Nintendo Wiki studios",
    report.studiosNameCollisions ?? [],
    'The first studio keeps the games. Remove the duplicate name from "igdbNames" in data/studios-overrides.json.',
  );
  section(
    "Studio overrides that match nothing",
    report.studiosUnusedOverrides ?? [],
    "No Nintendo Wiki page and no game with this developer: if the wiki renamed the page, rename the key in data/studios-overrides.json.",
  );
  section(
    "Released games not found on Metacritic",
    (report.metacritic?.notFound ?? []).map((m) => `${label(m)} ${dim(`tried /game/${m.slug}/`)}`),
    "If the page exists, set its URL in the admin panel (links.metacritic); the next fetch reads it.",
  );
  section(
    "Metacritic page of another game",
    (report.metacritic?.mismatched ?? []).map((m) => `${label(m)} ${dim(`/game/${m.slug}/ is "${m.name}"`)}`),
    "Set the right page URL in the admin panel (links.metacritic): a URL set by hand is always trusted.",
  );
  section("OpenCritic errors", report.opencritic.errors);
  section("Metacritic errors", report.metacritic?.errors ?? []);
  section("Wikipedia / Nintendo Wiki errors", report.linkErrors ?? []);
  section(
    "OpenCritic scores kept from the previous fetch",
    (report.opencritic.keptPrevious ?? []).map(label),
    "OpenCritic could not be checked for these; the next successful fetch refreshes them.",
  );
  if (report.metacritic?.unchecked) {
    console.log(dim(`\n${report.metacritic.unchecked} released game(s) not looked up on Metacritic yet: run \`npm run data:fetch-metacritic\`.`));
  }
  if (report.opencritic.budgetExhausted) {
    const queued = report.opencritic.queued ?? 0;
    console.log(dim(`\nOpenCritic budget exhausted${report.opencritic.stoppedBecause ? ` (${report.opencritic.stoppedBecause})` : ""}, ${queued} game(s) in queue for the next run.`));
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

if (process.argv.includes("--stubs") && gaps.scores.length) {
  // Only the blocks with gaps, pre-filled with what overrides.json already has.
  const stubs: Record<string, object> = {};
  for (const g of gaps.scores) {
    const o = overrides[g.id] ?? {};
    const stub: Record<string, unknown> = { _title: g.title };
    if (g.gaps.some((x) => x.source.startsWith("Metacritic"))) {
      stub.metacritic = { critic: null, criticCount: null, user: null, userCount: null, ...o.metacritic };
    }
    stubs[g.id] = stub;
  }
  console.log(`\n${bold("Overrides stubs")} ${dim("(fill in the numbers and merge into data/overrides.json)")}`);
  console.log(JSON.stringify(stubs, null, 2));
}

console.log(problems ? `\n${problems} item(s) to review.` : "\nNothing to review.");
