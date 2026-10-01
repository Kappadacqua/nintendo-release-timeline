import type { Game } from "../../src/types";
import type { FetchStatus } from "./cache";
import { readJson, writeJson } from "./cache";
import { intEnv } from "./env";
import { fetchText, HttpError } from "./http";
import { isAbsent, type OverridesFile } from "./overrides";
import { titleVariants } from "./title-variants";

/**
 * Metacritic has no API: scores are read from the public game page (inspired by
 * scripts/scraper.py). Only games already in the perimeter are looked up, by a slug
 * made from their title (else a search, exact name only) or taken from links.metacritic
 * in overrides.json: Metacritic enriches the list, it never adds games to it.
 */

const BASE = "https://www.metacritic.com/game/";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};
/** Random pause between two pages, as a person browsing would make. */
const DELAY_MS = [3000, 6000] as const;
const DAY_MS = 86_400_000;
/** "No page here": 404, or 410 for a page Metacritic removed ("Product gone"). */
const isGone = (err: unknown) => err instanceof HttpError && (err.status === 404 || err.status === 410);
/** Platforms whose scores are taken, in order of preference. */
const PLATFORMS = ["nintendo-switch-2", "nintendo-switch"];

export interface MetacriticScores {
  /** Game name on the page (JSON-LD), to catch a slug that leads to another game. */
  name: string | null;
  /** Platform of the Metascore ("nintendo-switch-2"…), null = page-wide value. */
  platform: string | null;
  critic: number | null;
  criticCount: number | null;
  user: number | null;
  userCount: number | null;
  /** "tbd" on the page: too few reviews for a score yet (not the same as no score at all). */
  criticTbd?: boolean;
  userTbd?: boolean;
}

export interface MetacriticEntry extends Partial<MetacriticScores> {
  /** Slug looked up: made from the title, or from links.metacritic. */
  slug: string;
  /**
   * ok: page read; not-found: no page (404) for the title, its shorter titles and a search;
   * gone: Metacritic removed the page (410), never looked up again; mismatch: the page is another game.
   */
  status: "ok" | "not-found" | "gone" | "mismatch";
  /** not-found / gone: the HTTP status of the title's page (404 or 410). */
  httpStatus?: number;
  checkedAt: string;
  /** Page read (found by search when the slug had no page); reused by later runs. */
  url: string;
  /** Shorter title that found the page (the base game's, SPEC §4.3), when not the full one. */
  matchedTitle?: string;
  /** Slug of the base game's page whose scores are used (found with a shorter title). */
  inheritedFrom?: string;
  /** not-found: how many titles were tried (absent = only the full one). */
  titlesTried?: number;
}

export interface MetacriticCache {
  /** Game id ("igdb:…" / "manual:…") → last answer. Failed calls leave the previous one. */
  games: Record<string, MetacriticEntry>;
}

export const loadMetacriticCache = (path: string) => readJson<MetacriticCache>(path, { games: {} });

/** Metacritic's slug for a title: "Pokémon Legends: Z-A" → "pokemon-legends-z-a". */
export function slugify(title: string) {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "and")
    .replace(/['’:.,!?()[\]"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Slug of a metacritic.com/game/<slug>/ URL. */
export function slugFromUrl(url: string | undefined) {
  return url ? (/metacritic\.com\/game\/([^/?#]+)/.exec(url)?.[1] ?? null) : null;
}

/** Title comparison that ignores case, accents and punctuation. */
export const sameName = (a: string, b: string) => {
  const norm = (t: string) => slugify(t).replace(/-/g, " ");
  return norm(a) === norm(b);
};

const toInt = (s: string | undefined) => (s ? Number(s.replace(/,/g, "")) : null);
/** "91", "8.9"; "tbd" / "null" (not enough reviews) → null. */
const toScore = (s: string | undefined) => (s && Number.isFinite(Number(s)) ? Number(s) : null);

/** Text between `marker` and the next `end` (or the end of the page). */
function section(html: string, marker: string, end?: string) {
  const start = html.indexOf(marker);
  if (start < 0) return "";
  const stop = end ? html.indexOf(end, start + marker.length) : -1;
  return html.slice(start, stop < 0 ? undefined : stop);
}

// Scored: aria-label="Metascore 95 out of 100"; no score yet: aria-label="Metascore tbd".
const METASCORE = /aria-label="Metascore ([^ "]+)(?: out of 100)?"/;
const USER_SCORE = /aria-label="User score ([^ "]+)(?: out of 10)?"/;
const PLATFORM = /[?&]platform=([a-z0-9-]+)/;

/**
 * The "All Platforms" cards: <a href="…?platform=…" data-testid="product-score-card"> once
 * scored, <div to="…?platform=…" data-testid="product-score-card"> while "tbd".
 */
function platformCards(html: string) {
  const all = section(html, 'data-testid="all-platforms"', "</section>");
  const starts = [...all.matchAll(/<(?:a|div)\b[^>]*data-testid="product-score-card"[^>]*>/g)];
  return starts.map((m, i) => {
    const card = all.slice(m.index, starts[i + 1]?.index);
    const label = METASCORE.exec(card);
    return {
      platform: PLATFORM.exec(m[0])?.[1] ?? null,
      label: label !== null,
      score: toScore(label?.[1]),
      count: toInt(/Based on ([\d,]+) Critic Reviews?/.exec(card)?.[1]),
    };
  });
}

/**
 * Scores from a game page. The Metascore comes from the per-platform cards ("All Platforms"),
 * Switch 2 first, else the page-wide JSON-LD value; the user score only exists for the page's
 * main platform, so it is kept only when that platform is a Nintendo one.
 */
export function parseMetacriticPage(html: string): MetacriticScores {
  const out: MetacriticScores = { name: null, platform: null, critic: null, criticCount: null, user: null, userCount: null };

  for (const [, json] of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(json) as unknown;
      for (const item of Array.isArray(data) ? data : [data]) {
        if (!item || typeof item !== "object") continue;
        const { name, aggregateRating: rating } = item as { name?: string; aggregateRating?: { ratingValue?: unknown; reviewCount?: unknown } };
        if (typeof name === "string") out.name ??= name;
        if (rating) {
          out.critic = toScore(String(rating.ratingValue ?? ""));
          out.criticCount = toInt(String(rating.reviewCount ?? "") || undefined);
        }
      }
    } catch {
      // A broken block: the other sources below still apply.
    }
  }

  // <a data-testid="product-score-card" href="…?platform=nintendo-switch-2">…Based on 56 Critic Reviews…Metascore 95 out of 100…</a>
  const cards = new Map(platformCards(html).flatMap((c) => (c.platform ? [[c.platform, c] as const] : [])));
  const platform = PLATFORMS.find((p) => cards.has(p));
  if (platform) {
    const card = cards.get(platform)!;
    Object.assign(out, { platform, critic: card.score, criticCount: card.count });
    if (card.label && card.score === null) out.criticTbd = true;
  }

  const users = section(html, 'data-testid="user-reviews"', "</section>");
  const userPlatform = PLATFORM.exec(users)?.[1];
  if (userPlatform && PLATFORMS.includes(userPlatform)) {
    out.user = toScore(USER_SCORE.exec(users)?.[1]);
    out.userCount = toInt(/Based on ([\d,]+) User Ratings?/.exec(users)?.[1]);
  }
  // While "tbd" the section has no platform link, so it is read on its own.
  if (out.user === null && USER_SCORE.exec(users)?.[1]?.toLowerCase() === "tbd") out.userTbd = true;
  return out;
}

/** Where the parser looks: named in the error when a page no longer matches. */
const PARSER = "parseMetacriticPage in scripts/lib/metacritic.ts";
/** Pages in a row with an unknown layout before the run stops. */
const MAX_LAYOUT_ERRORS = 3;

/** The per-run request budget ran out in the middle of a game: it is retried next run. */
class OutOfBudget extends Error {}

/** A page that loads but no longer has the markup the parser reads. */
export class LayoutError extends Error {}

/**
 * What the parser expected and did not find, or null. Checked before reading the scores,
 * so that a Metacritic redesign shows up as an error instead of scores silently gone.
 */
export function layoutIssue(html: string): string | null {
  const missing: string[] = [];
  if (!/<script type="application\/ld\+json"[^>]*>[\s\S]*?"name"/.test(html)) missing.push("JSON-LD game data");
  const cards = platformCards(html);
  if (!html.includes('data-testid="all-platforms"')) missing.push('"All Platforms" section (data-testid="all-platforms")');
  else if (!cards.length || cards.some((c) => !c.platform || !c.label)) {
    missing.push('Metascore cards (data-testid="product-score-card" with ?platform=, aria-label "Metascore …")');
  }
  const users = section(html, 'data-testid="user-reviews"', "</section>");
  // No platform link is normal while the user score is "TBD"; no label at all is not.
  if (users && !USER_SCORE.test(users)) missing.push('user score (data-testid="user-reviews", aria-label "User score …")');
  return missing.length ? `not found: ${missing.join("; ")}` : null;
}

const decodeEntities = (s: string) =>
  s.replace(/&(amp|quot|#39|apos|lt|gt);/g, (_, e: string) => ({ amp: "&", quot: '"', "#39": "'", apos: "'", lt: "<", gt: ">" })[e]!);

/** Results of a search page (/search/<title>/?category=13): slug and name of each game. */
export function parseSearchResults(html: string) {
  return html
    .split('data-testid="search-item"')
    .slice(1)
    .flatMap((item) => {
      const slug = /href="\/game\/([^/"]+)\/"/.exec(item)?.[1];
      const name = /alt="([^"]*)"/.exec(item)?.[1];
      return slug && name ? [{ slug, name: decodeEntities(name) }] : [];
    });
}

/**
 * Whether a game's page is due again: a new slug always; a page found daily for the
 * first 60 days after release, then weekly; a missing page (404) after 3 days, 30 once the
 * game is a month old; another game's page after 3 days, then 14; a removed page (410) never.
 */
export function isDue(entry: MetacriticEntry | undefined, slug: string, daysSinceRelease: number, now = Date.now()) {
  if (!entry || entry.slug !== slug) return true;
  if (entry.status === "gone") return false;
  const age = now - Date.parse(entry.checkedAt);
  const recent = daysSinceRelease < 30;
  const maxDays =
    entry.status === "ok" ? (daysSinceRelease < 60 ? 1 : 7) : recent ? 3 : entry.status === "not-found" ? 30 : 14;
  // A little slack so a daily run at a slightly earlier time still refreshes.
  return age >= maxDays * DAY_MS - 2 * 3_600_000;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Reads the Metacritic page of every released game in `games` that is due, newest first
 * (never-checked ones before all others), into the cache at `cachePath`. Stops at the
 * per-run budget or as soon as Metacritic blocks the requests (403 / 429).
 */
export async function fetchMetacritic(
  games: Game[],
  overridesFile: OverridesFile,
  cachePath: string,
  status: NonNullable<FetchStatus["metacritic"]>,
  log: (...args: unknown[]) => void,
) {
  const cache = loadMetacriticCache(cachePath);
  // A slug with no page costs up to 3 requests (page, search, page found).
  const budget = intEnv("METACRITIC_MAX_REQUESTS", 150);
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  const daysSince = (iso: string) => Math.floor((Date.parse(today) - Date.parse(iso)) / DAY_MS);

  const todo = games
    .filter((g) => g.kind !== "free-update" && g.firstReleaseDate && g.firstReleaseDate <= today)
    // Confirmed by hand: no Metacritic page, not looked up again.
    .filter((g) => !isAbsent(overridesFile.games[g.id], "metacritic"))
    .map((g) => {
      const forced = slugFromUrl(overridesFile.games[g.id]?.links?.metacritic ?? g.links.metacritic);
      return { game: g, slug: forced ?? slugify(g.title), forced: forced !== null, age: daysSince(g.firstReleaseDate!) };
    })
    .filter((t) => {
      const entry = cache.games[t.game.id];
      // Missed before the base game's shorter titles were tried, or before 404 and 410 were told apart: due now.
      const untried =
        entry?.status === "not-found" && (entry.httpStatus === undefined || (!t.forced && (entry.titlesTried ?? 1) < titleVariants(t.game.title).length));
      return t.slug && (untried || isDue(entry, t.slug, t.age, now));
    })
    .sort((a, b) => Number(a.game.id in cache.games) - Number(b.game.id in cache.games) || a.age - b.age);
  status.enabled = true;
  status.due = todo.length;
  let layoutErrors = 0;

  let sent = 0;
  for (const { game, slug, forced } of todo) {
    if (status.requestsUsed >= budget) {
      status.budgetExhausted = true;
      break;
    }
    status.checked++;
    const previous = cache.games[game.id];
    const checkedAt = new Date().toISOString();
    const get = async (target: string) => {
      if (status.requestsUsed >= budget) throw new OutOfBudget();
      status.requestsUsed++;
      if (sent++) await sleep(DELAY_MS[0] + Math.random() * (DELAY_MS[1] - DELAY_MS[0]));
      // 5xx and timeouts: 2 retries with backoff; a 429 stops the run at once (below).
      return fetchText(target, { headers: HEADERS, label: `Metacritic ${new URL(target).pathname}`, retry429: false }, 2);
    };
    /** HTTP status of the first missing page (the full title's): 410 = removed for good. */
    let missing: number | undefined;
    /** The page at `target`, else (404 / 410) a search for `title`, exact name only; null = no page. */
    const pageFor = async (target: string, title: string) => {
      try {
        return { url: target, html: await get(target) };
      } catch (err) {
        if (!isGone(err)) throw err;
        missing ??= (err as HttpError).status;
        if (forced) return null;
      }
      const hits = parseSearchResults(await get(`https://www.metacritic.com/search/${encodeURIComponent(title)}/?category=13`));
      const hit = hits.find((h) => sameName(h.name, title));
      if (!hit) return null;
      const url = `${BASE}${hit.slug}/`;
      return { url, html: await get(url) };
    };
    try {
      // A page found before (by search or a shorter title): straight there.
      const known = previous?.slug === slug && previous.status === "ok" ? previous : undefined;
      let found: { url: string; html: string } | null = null;
      let title = known?.matchedTitle ?? game.title;
      if (known) found = await pageFor(known.url, known.matchedTitle ?? game.title);
      else {
        // Full title first, then the base game's shorter titles (SPEC §4.3).
        for (const candidate of forced ? [game.title] : titleVariants(game.title)) {
          found = await pageFor(candidate === game.title ? `${BASE}${slug}/` : `${BASE}${slugify(candidate)}/`, candidate);
          if (found) {
            title = candidate;
            break;
          }
        }
      }
      if (!found) {
        const titlesTried = forced ? 1 : titleVariants(game.title).length;
        cache.games[game.id] = {
          slug,
          url: `${BASE}${slug}/`,
          checkedAt,
          status: missing === 410 ? "gone" : "not-found",
          httpStatus: missing ?? 404,
          ...(titlesTried > 1 ? { titlesTried } : {}),
        };
        continue;
      }
      const { url, html } = found;
      const issue = layoutIssue(html);
      if (issue) throw new LayoutError(`Metacritic page layout not recognized at ${url} — ${issue}. Previous scores kept; update ${PARSER}.`);
      const page = parseMetacriticPage(html);
      // A title-made slug can land on an older game of the same name: only a forced slug skips the check.
      const mismatch = !forced && page.name !== null && !sameName(page.name, title);
      const inherited = title !== game.title ? { matchedTitle: title, inheritedFrom: slugFromUrl(url) ?? undefined } : {};
      cache.games[game.id] = { slug, url, checkedAt, status: mismatch ? "mismatch" : "ok", ...inherited, ...page };
    } catch (err) {
      if (err instanceof OutOfBudget) {
        status.budgetExhausted = true;
        break;
      }
      status.errors.push(`${game.title}: ${(err as Error).message}`);
      layoutErrors = err instanceof LayoutError ? layoutErrors + 1 : 0;
      if (layoutErrors >= MAX_LAYOUT_ERRORS) {
        status.stoppedBecause = `Metacritic changed its page layout (${layoutErrors} pages in a row not recognized): update ${PARSER}`;
        break;
      }
      if (err instanceof HttpError && [403, 429].includes(err.status)) {
        // Blocked: stop here, the cache keeps serving the build.
        status.stoppedBecause = `Metacritic answered HTTP ${err.status} (blocked or rate-limited)`;
        break;
      }
    }
  }
  writeJson(cachePath, cache);
  log(`Metacritic: ${status.checked} of ${status.due} due game(s) checked in ${status.requestsUsed} request(s)${status.stoppedBecause ? ` — stopped: ${status.stoppedBecause}` : status.budgetExhausted ? " — per-run budget reached, run again later" : ""}`);
}

export const emptyMetacriticStatus = (): NonNullable<FetchStatus["metacritic"]> => ({
  enabled: false,
  due: 0,
  checked: 0,
  requestsUsed: 0,
  budgetExhausted: false,
  stoppedBecause: null,
  errors: [],
});
