// Schema of public/data/games.json (SPEC §5).

export type Region = "JP" | "EU" | "NA";

/** Score sources tracked over time (ITERATION-3 §3). */
export type ScoreSource = "opencritic" | "metacritic" | "metacriticUser" | "backloggd";

export interface Score {
  value: number; // original value
  scale: 5 | 10 | 100;
  normalized: number; // 0–100
  count: number | null;
}

export interface Game {
  id: string; // "igdb:<id>"
  /** "free-update": a Switch game's free Switch 2 update, placed on the update date, no scores. */
  kind: "game" | "switch2-edition" | "dlc" | "free-update";
  title: string;
  baseGameTitle?: string; // DLC only
  coverUrl: string;
  summary: string | null; // IGDB summary
  backgroundUrl: string | null; // IGDB artwork → screenshot → cover
  developer: string | null;
  genres: string[];
  releaseDates: Partial<Record<Region, string | null>>; // "YYYY-MM-DD" or null = TBA
  firstReleaseDate: string | null;
  /** First release date as observed by each data:fetch, changes only (oldest first). */
  dateHistory?: { date: string; firstReleaseDate: string | null }[];
  /** Normalized score per source over time, changes only (oldest first). */
  scoreHistory?: Partial<Record<ScoreSource, { date: string; normalized: number }[]>>;
  vagueRelease?: { year: number; label: string };
  /** Free updates only: year the game first came out on Switch. */
  originalReleaseYear?: number;
  exclusivity: "exclusive" | "timed" | null;
  /** Published by Nintendo / The Pokémon Company (or a DLC / edition of such a game). */
  firstParty: boolean;
  alsoOnSwitch1: boolean;
  /** Also on a console or PC that isn't a Nintendo one (phones don't count); absent for manual games. */
  onOtherConsoles?: boolean;
  scores: {
    critic: {
      opencritic: Score | null;
      metacritic: Score | null;
    };
    user: {
      metacritic: Score | null; // original 0–10
      backloggd: Score | null; // original 0–5
    };
  };
  links: {
    opencritic?: string;
    metacritic?: string;
    backloggd?: string;
    wikipedia?: string;
    nintendoWiki?: string;
    nintendoStore?: string;
  };
}

export interface GamesFile {
  generatedAt: string;
  games: Game[];
}

/** One entry of public/data/changes.json (ITERATION-3 §4), found by comparing snapshots. */
export type Change = { date: string; id: string } & (
  | { type: "new" }
  | { type: "delayed"; from: string; to: string | null }
  | { type: "reviews-in"; source: "opencritic" | "metacritic"; normalized: number }
);

export interface ChangesFile {
  generatedAt: string;
  changes: Change[];
}

/** The game a studio card shows (public/data/studios.json): next one out, else the latest. */
export interface StudioGame {
  id: string;
  title: string;
  coverUrl: string;
  date: string; // "YYYY-MM-DD"
  status: "upcoming" | "released";
}

/** One studio of public/data/studios.json. */
export interface Studio {
  name: string;
  /** Nintendo Wiki page; null for third-party studios. */
  url: string | null;
  /** In Nintendo Wiki's first party developers; false = third party with an exclusive in games.json. */
  firstParty: boolean;
  game: StudioGame | null;
  /** At least one game or Switch 2 Edition playable on Switch 2 in games.json (DLC and free updates excluded). */
  hasSwitch2Game: boolean;
}

export interface StudiosFile {
  generatedAt: string;
  studios: Studio[];
}
