import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("../../", import.meta.url));

export const PATHS = {
  games: `${ROOT}public/data/games.json`,
  changes: `${ROOT}public/data/changes.json`,
  studios: `${ROOT}public/data/studios.json`,
  overrides: `${ROOT}data/overrides.json`,
  history: `${ROOT}data/exclusivity-history.json`,
  report: `${ROOT}data/fetch-report.json`,
  opencriticCache: `${ROOT}data/cache/opencritic.json`,
  igdbCache: `${ROOT}data/cache/igdb.json`,
  wikipediaCache: `${ROOT}data/cache/wikipedia.json`,
  linksCache: `${ROOT}data/cache/links.json`,
  fetchStatus: `${ROOT}data/cache/fetch-status.json`,
  settings: `${ROOT}data/settings.json`,
  freeUpdates: `${ROOT}data/free-updates.json`,
  freeUpdatesCache: `${ROOT}data/cache/free-updates.json`,
  freeUpdatesSeen: `${ROOT}data/free-updates-seen.json`,
  /** One file per data:fetch day; SNAPSHOTS_DIR points elsewhere (e.g. for tests). */
  snapshots: process.env.SNAPSHOTS_DIR ?? `${ROOT}data/snapshots`,
};

// Node ≥ 20.12 reads .env natively; values already in the environment win.
if (existsSync(`${ROOT}.env`)) process.loadEnvFile(`${ROOT}.env`);

export function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function requireEnv(name: string): string {
  const value = env(name);
  if (!value) throw new Error(`Missing ${name}. Copy .env.example to .env and fill it in.`);
  return value;
}

export function intEnv(name: string, fallback: number): number {
  const value = Number(env(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
