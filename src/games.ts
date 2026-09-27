import type { Game, GamesFile } from "./types";

/** public/data/games.json, shared by the timeline and the rankings page. */
export async function loadGames(): Promise<Game[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/games.json`);
  if (!res.ok) throw new Error(`games.json: HTTP ${res.status}`);
  const data = (await res.json()) as GamesFile;
  return data.games;
}
