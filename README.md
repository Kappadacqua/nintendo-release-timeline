# Nintendo Release Timeline

A personal site that shows Nintendo releases from June 5, 2025 onwards on a horizontal timeline — Nintendo and Pokémon Company games, their DLC and Switch 2 Editions, third-party exclusives and free Switch 2 updates —, with critic and user scores, and a vertical layout on phones. Game data is collected by Node scripts and served as static JSON. It is published on GitHub Pages (https://kappadacqua.github.io/nintendo-release-timeline/) with a nightly data update.

Built with Vite 7 and vanilla TypeScript (no UI framework), GSAP for animations and Fuse.js for search.

## Requirements

- Node.js 20.19 or later (`engines` in `package.json`; `.env` is read with Node's built-in `process.loadEnvFile`).
- API credentials only for the fetch scripts. The site and `data:build` work offline.

## Installation

```sh
npm install
cp .env.example .env   # then fill in the values
```

Variables in `.env` (see `.env.example` for comments):

| Variable | Used for |
|---|---|
| `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | IGDB (required by `data:fetch` and `data:fetch-free-updates`) |
| `RAPIDAPI_KEY` | OpenCritic via RapidAPI (optional: without it scores are missing) |
| `OPENCRITIC_MAX_SEARCHES`, `OPENCRITIC_MAX_REQUESTS` | Per-run caps to stay inside the daily quota |
| `OPENCRITIC_CATALOG_DAYS` | Age after which the Switch 2 catalog is downloaded again |
| `WIKI_CONTACT` | Contact added to the Wikipedia / Nintendo Wiki User-Agent |

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server, including the admin panel |
| `npm run build` | Typecheck + production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | TypeScript check only |
| `npm test` | Vitest unit tests (`*.test.ts` next to the modules) |
| `npm run data:fetch` | Call the APIs, refresh `data/cache/`, then build (network, limited quota) |
| `npm run data:build` | Rebuild `public/data/` from cache + overrides (no network) |
| `npm run data:validate` | List missing data and conflicts (`-- --stubs` prints JSON to fill in) |
| `npm run data:fetch-free-updates` | Refresh the free Switch 2 updates cache (network) |
| `npm run data:fetch-studios` | Refresh the first-party studios cache from Nintendo Wiki (network; `-- --force` accepts a shorter list) |

## Data pipeline

```
fetch  →  data/cache/  →  build  →  public/data/  →  site
```

1. **Fetch** (`scripts/fetch-*.ts`): raw responses from IGDB, OpenCritic, Wikipedia and Nintendo Wiki are saved in `data/cache/`. `data:fetch` also writes a daily snapshot in `data/snapshots/`.
2. **Build** (`scripts/build-data.ts`, no network): combines the cache with hand-edited files in `data/` — `overrides.json` (manual scores, links, exclusivity), `settings.json`, `free-updates.json`, `studios-overrides.json`, exclusivity history and snapshots.
3. **Output** in `public/data/`: `games.json` (every release), `changes.json` (delays and score history for "What's new") and `studios.json`. The build also writes `data/fetch-report.json` and updates `data/free-updates-seen.json`.

`data/free-updates-seen.json` is tracked in Git and must never be deleted: without it, "What's new" treats every free update as already known.

## Pages

- `index.html` — the timeline: Day/Week/Month zoom, minimap, filters, search, "What's new", presentation mode, light/dark theme.
- `rankings.html` — games ranked by score source, with a minimum review count and filters.
- `studios.html` — Nintendo first-party and partner studios with their latest or upcoming Switch 2 game; third-party studios behind a toggle.

## Admin panel

Available at `/admin` with `npm run dev` only (it is not part of the production build). It lists games with missing data (Metacritic, Backloggd, links, OpenCritic match, exclusivity conflicts) and edits their entries in `data/overrides.json`. On save, the Vite plugin (`scripts/vite-admin.ts`) validates the file, backs up the previous copy in `data/backups/`, runs `data:build`, and open pages reload.

The "Data sources" box shows when each source was last read, and each game shows when its OpenCritic and Metacritic scores are read again: daily while a game is new, then every week or two (`scripts/lib/refresh-policy.ts`).

A checklist of games still missing manual links is in `data/manual-todo.md` (`npm run data:validate -- --todo`).

## Publishing

`.github/workflows/update-and-deploy.yml` fetches the data every night, commits it to `main` and deploys the site to GitHub Pages (`BASE_PATH` sets Vite's `base`). The API keys are GitHub Secrets. A push to `main` only rebuilds and deploys. The bot commits to `main` every night, so pull before working locally. On the free GitHub plan the repository must stay public (Pages on a private repository needs a paid plan).

## Project layout

```
src/            site code (timeline/, cards/, rankings/, studios/, admin/, styles/, theme/)
scripts/        data pipeline (fetch, build, validate) and the admin Vite plugin
data/           hand-edited inputs, cache, snapshots, backups
public/data/    generated JSON served to the site
docs/           specification, reviews, task queues
```

## Documentation

- `docs/SPEC.md` — the full specification (in Italian).
- `STATUS.md` — current state, open issues and next steps.
- `docs/review/` — code review findings and triage.
- `CLAUDE.md` — module map and working rules for coding agents.
