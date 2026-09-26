import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("../../", import.meta.url));

export const PATHS = {
  games: `${ROOT}public/data/games.json`,
  overrides: `${ROOT}data/overrides.json`,
  history: `${ROOT}data/exclusivity-history.json`,
  report: `${ROOT}data/fetch-report.json`,
  opencriticCache: `${ROOT}data/cache/opencritic.json`,
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
