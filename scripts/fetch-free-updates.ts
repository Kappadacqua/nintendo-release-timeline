/**
 * npm run data:fetch-free-updates — for each title in data/free-updates.json: the original
 * game on IGDB (id, cover, summary), Wikipedia / Nintendo Wiki links and eShop ids, saved in
 * data/cache/free-updates.json. IGDB: the entries' `igdbId`s, one bulk query by title, plus one
 * multiquery search for the rest. A link source that fails keeps its links from the previous
 * cache. Run `npm run data:build` afterwards.
 */
import { readJson, writeJson } from "./lib/cache";
import { env, PATHS, requireEnv } from "./lib/env";
import { emptyFreeUpdatesCache, type FreeUpdatesCache, loadFreeUpdates, pickIgdbGame } from "./lib/free-updates";
import { GAME_FIELDS, Igdb, type IgdbGame, PLATFORM } from "./lib/igdb";
import { nintendoWikiByTitle, wikidataBySlug, wikipediaByTitle } from "./lib/links";
import { sameTitle } from "./lib/transform";

const log = (...args: unknown[]) => console.log("•", ...args);
const onSwitch = `platforms = (${PLATFORM.SWITCH},${PLATFORM.SWITCH_2})`;

async function main() {
  const entries = loadFreeUpdates();
  if (!entries.length) throw new Error("No games in data/free-updates.json.");
  const previous = { ...emptyFreeUpdatesCache(), ...readJson<Partial<FreeUpdatesCache>>(PATHS.freeUpdatesCache, {}) };
  const cache: FreeUpdatesCache = { ...emptyFreeUpdatesCache(), fetchedAt: new Date().toISOString() };
  const igdb = await Igdb.connect(requireEnv("TWITCH_CLIENT_ID"), requireEnv("TWITCH_CLIENT_SECRET"));
  const found = new Map<string, IgdbGame>();

  // 0. Games chosen by hand with `igdbId`.
  const pinned = entries.filter((e) => e.igdbId !== undefined);
  if (pinned.length) {
    const byId = await igdb.query<IgdbGame>("games", `fields ${GAME_FIELDS}; where id = (${pinned.map((e) => e.igdbId).join(",")}); limit 500;`);
    for (const e of pinned) {
      const hit = byId.find((g) => g.id === e.igdbId);
      if (hit) found.set(e.title, hit);
    }
  }

  // 1. Every other title at once, case-insensitive exact name.
  const byTitle = entries.filter((e) => e.igdbId === undefined);
  if (byTitle.length) {
    const names = byTitle.map((e) => `name ~ ${JSON.stringify(e.title)}`).join(" | ");
    const exact = await igdb.query<IgdbGame>("games", `fields ${GAME_FIELDS}; where (${names}) & ${onSwitch}; limit 500;`);
    for (const e of byTitle) {
      const hit = pickIgdbGame(e, exact);
      if (hit) found.set(e.title, hit);
    }
  }

  // 2. The rest: text search (multiquery, up to 10 per request). Accepted on the same
  // title, or on the same original release year (titles written differently on IGDB): the
  // latter is marked approximate, for data:validate.
  const rest = byTitle.filter((e) => !found.has(e.title));
  for (let i = 0; i < rest.length; i += 10) {
    const batch = rest.slice(i, i + 10);
    const body = batch
      .map((e, j) => `query games "q${j}" { search ${JSON.stringify(e.title)}; fields ${GAME_FIELDS}; where ${onSwitch}; limit 5; };`)
      .join("\n");
    const res = await igdb.query<{ name: string; result: IgdbGame[] }>("multiquery", body);
    batch.forEach((e, j) => {
      const hits = res.find((r) => r.name === `q${j}`)?.result ?? [];
      const year = e.game_release_date.slice(0, 4);
      const same = hits.find((g) => sameTitle(g.name, e.title));
      const sameYear = hits.find((g) => g.first_release_date && new Date(g.first_release_date * 1000).getUTCFullYear() === Number(year));
      if (same) found.set(e.title, same);
      else if (sameYear) {
        found.set(e.title, sameYear);
        cache.approximate.push(e.title);
      }
    });
  }

  for (const e of entries) cache.matches[e.title] = found.get(e.title)?.id ?? null;
  cache.games = [...new Map([...found.values()].map((g) => [g.id, g])).values()];

  // Links: Wikidata by IGDB slug (Wikipedia article, eShop ids), then titles for what is missing.
  const userAgent = `NintendoReleaseTimeline/0.1 (personal project; ${env("WIKI_CONTACT") ?? "no contact set"})`;
  const errors: string[] = [];
  const titles = entries.map((e) => e.title);
  try {
    const wikidata = await wikidataBySlug(cache.games.map((g) => g.slug), userAgent);
    for (const e of entries) {
      const slug = found.get(e.title)?.slug;
      const w = slug ? wikidata.get(slug) : undefined;
      if (w?.wikipedia) cache.wikipediaByTitle[e.title] = w.wikipedia;
      if (slug && w?.eshopEu) cache.eshopEuBySlug[slug] = w.eshopEu;
      if (slug && w?.eshopUs) cache.eshopUsBySlug[slug] = w.eshopUs;
    }
  } catch (err) {
    errors.push(`Wikidata: ${(err as Error).message}`);
    for (const t of titles) if (previous.wikipediaByTitle[t]) cache.wikipediaByTitle[t] = previous.wikipediaByTitle[t];
    for (const { slug } of cache.games) {
      if (previous.eshopEuBySlug[slug]) cache.eshopEuBySlug[slug] = previous.eshopEuBySlug[slug];
      if (previous.eshopUsBySlug[slug]) cache.eshopUsBySlug[slug] = previous.eshopUsBySlug[slug];
    }
  }
  try {
    const missing = titles.filter((t) => !cache.wikipediaByTitle[t]);
    for (const [t, url] of await wikipediaByTitle(missing, userAgent)) cache.wikipediaByTitle[t] = url;
  } catch (err) {
    errors.push(`Wikipedia: ${(err as Error).message}`);
    for (const t of titles) if (!cache.wikipediaByTitle[t] && previous.wikipediaByTitle[t]) cache.wikipediaByTitle[t] = previous.wikipediaByTitle[t];
  }
  try {
    for (const [t, url] of await nintendoWikiByTitle(titles, userAgent)) cache.nintendoWikiByTitle[t] = url;
  } catch (err) {
    errors.push(`Nintendo Wiki: ${(err as Error).message}`);
    for (const t of titles) if (previous.nintendoWikiByTitle[t]) cache.nintendoWikiByTitle[t] = previous.nintendoWikiByTitle[t];
  }
  writeJson(PATHS.freeUpdatesCache, cache);

  const notFound = entries.filter((e) => !found.has(e.title)).map((e) => e.title);
  const withCover = entries.filter((e) => found.get(e.title)?.cover?.image_id).length;
  const count = (r: Record<string, string>) => titles.filter((t) => r[t]).length;
  log(`IGDB: ${found.size}/${entries.length} found, ${withCover} with a cover`);
  if (notFound.length) log(`Not found on IGDB: ${notFound.join(", ")}`);
  if (cache.approximate.length) console.error(`⚠ Matched by release year only (check, or set igdbId): ${cache.approximate.join(", ")}`);
  log(`Links: Wikipedia ${count(cache.wikipediaByTitle)}/${entries.length}, Nintendo Wiki ${count(cache.nintendoWikiByTitle)}/${entries.length}`);
  for (const e of errors) console.error(`⚠ ${e.slice(0, 200)} (previous links kept)`);
  log("Saved data/cache/free-updates.json. Run `npm run data:build`.");
}

main().catch((err) => {
  console.error(`✗ ${(err as Error).message}`);
  process.exit(1);
});
