import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { Game } from "../../src/types";

interface HistoryEntry {
  title: string;
  firstSeenExclusive: string;
  lastSeenExclusive: string;
  /** Set the first run the game is no longer exclusive. */
  lostExclusivity?: string;
}

interface HistoryFile {
  games: Record<string, HistoryEntry>;
}

/**
 * data/exclusivity-history.json (SPEC §4.1): once a game has been seen as
 * exclusive, losing that status later makes it a timed exclusive.
 */
export class ExclusivityHistory {
  private readonly data: HistoryFile;
  private readonly today = new Date().toISOString().slice(0, 10);

  constructor(private readonly path: string) {
    this.data = existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as HistoryFile) : { games: {} };
  }

  /** Records today's computed status and returns the final value. */
  resolve(id: string, title: string, exclusiveNow: boolean): Game["exclusivity"] {
    const entry = this.data.games[id];
    if (exclusiveNow) {
      this.data.games[id] = {
        title,
        firstSeenExclusive: entry?.firstSeenExclusive ?? this.today,
        lastSeenExclusive: this.today,
      };
      return "exclusive";
    }
    if (!entry) return null;
    entry.lostExclusivity ??= this.today;
    return "timed";
  }

  save() {
    writeFileSync(this.path, `${JSON.stringify(this.data, null, 2)}\n`);
  }
}
