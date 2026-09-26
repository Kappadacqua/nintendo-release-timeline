import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { delaysOf } from "../../src/history";
import type { Change, Game, ScoreSource } from "../../src/types";

/**
 * data/snapshots/YYYY-MM-DD.json, written by every data:fetch (ITERATION-3 §3):
 * what each game looked like that day. data:build turns them into histories.
 */
export interface SnapshotGame {
  title: string;
  releaseDates: Game["releaseDates"];
  firstReleaseDate: string | null;
  vague: string | null;
  scores: Partial<Record<ScoreSource, number>>;
}

export interface Snapshot {
  date: string;
  games: Record<string, SnapshotGame>;
}

function scoresOf(g: Game): SnapshotGame["scores"] {
  const out: SnapshotGame["scores"] = {};
  const put = (key: ScoreSource, s: { normalized: number } | null) => {
    if (s) out[key] = s.normalized;
  };
  put("opencritic", g.scores.critic.opencritic);
  put("metacritic", g.scores.critic.metacritic);
  put("metacriticUser", g.scores.user.metacritic);
  put("backloggd", g.scores.user.backloggd);
  return out;
}

export function snapshotOf(games: Game[], date: string): Snapshot {
  return {
    date,
    games: Object.fromEntries(
      games.map((g) => [
        g.id,
        {
          title: g.title,
          releaseDates: g.releaseDates,
          firstReleaseDate: g.firstReleaseDate,
          vague: g.vagueRelease?.label ?? null,
          scores: scoresOf(g),
        },
      ]),
    ),
  };
}

/** One per day: a second fetch the same day replaces it. */
export function writeSnapshot(dir: string, snapshot: Snapshot) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${snapshot.date}.json`), `${JSON.stringify(snapshot, null, 1)}\n`);
}

export function readSnapshots(dir: string): Snapshot[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Snapshot);
}

const SOURCES: ScoreSource[] = ["opencritic", "metacritic", "metacriticUser", "backloggd"];

/**
 * dateHistory and scoreHistory for each game, from the snapshots plus today's
 * values as the latest point (a snapshot of today, if any, is replaced by them).
 * Only changes are kept, so the files stay small and a sparkline has a real trend.
 */
/** The snapshots before today, then today's values (they replace a snapshot of today). */
const timeline = (games: Game[], snapshots: Snapshot[], today: string) => [
  ...snapshots.filter((s) => s.date < today),
  snapshotOf(games, today),
];

export function addHistory(games: Game[], snapshots: Snapshot[], today: string) {
  const points = timeline(games, snapshots, today);
  for (const game of games) {
    const seen = points.flatMap((s) => (s.games[game.id] ? [{ date: s.date, g: s.games[game.id] }] : []));

    const dates: NonNullable<Game["dateHistory"]> = [];
    for (const { date, g } of seen) {
      // A regional date alone changing (e.g. EU after JP) does not move firstReleaseDate: not recorded.
      if (dates.at(-1)?.firstReleaseDate !== g.firstReleaseDate || !dates.length) dates.push({ date, firstReleaseDate: g.firstReleaseDate });
    }
    if (dates.length > 1) game.dateHistory = dates;

    const scores: NonNullable<Game["scoreHistory"]> = {};
    for (const source of SOURCES) {
      const series: { date: string; normalized: number }[] = [];
      for (const { date, g } of seen) {
        const v = g.scores[source];
        if (v !== undefined && series.at(-1)?.normalized !== v) series.push({ date, normalized: v });
      }
      if (series.length > 1) scores[source] = series;
    }
    if (Object.keys(scores).length) game.scoreHistory = scores;
  }
}

/** How far back changes.json goes: the panel groups by week, a few weeks are enough. */
const CHANGES_DAYS = 60;
const CRITICS = ["opencritic", "metacritic"] as const;

/**
 * public/data/changes.json (ITERATION-3 §4): each point compared with the one before.
 * The first snapshot is the baseline, so nothing is "new" in it. Newest first.
 */
export function changesOf(games: Game[], snapshots: Snapshot[], today: string): Change[] {
  const points = timeline(games, snapshots, today);
  const since = new Date(Date.parse(today) - CHANGES_DAYS * 86_400_000).toISOString().slice(0, 10);
  const out: Change[] = [];
  const seen = new Set(Object.keys(points[0].games));
  for (let i = 1; i < points.length; i++) {
    const { date, games: now } = points[i];
    const before = points[i - 1].games;
    for (const [id, g] of Object.entries(now)) {
      if (!seen.has(id)) {
        // Missing from every earlier point, not just a failed fetch the day before.
        seen.add(id);
        out.push({ date, id, type: "new" });
        continue;
      }
      const prev = before[id];
      if (!prev) continue;
      const [delay] = delaysOf([
        { date: "", firstReleaseDate: prev.firstReleaseDate },
        { date, firstReleaseDate: g.firstReleaseDate },
      ]);
      if (delay) out.push({ date, id, type: "delayed", from: delay.from, to: delay.to });
      const first = CRITICS.find((s) => g.scores[s] !== undefined);
      if (first && CRITICS.every((s) => prev.scores[s] === undefined)) {
        out.push({ date, id, type: "reviews-in", source: first, normalized: g.scores[first]! });
      }
    }
  }
  const current = new Set(games.map((g) => g.id));
  return out.filter((c) => c.date >= since && current.has(c.id)).reverse();
}
