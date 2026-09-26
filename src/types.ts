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
  kind: "game" | "switch2-edition" | "dlc";
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
  exclusivity: "exclusive" | "timed" | null;
  /** Published by Nintendo / The Pokémon Company (or a DLC / edition of such a game). */
  firstParty: boolean;
  alsoOnSwitch1: boolean;
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
