import { fetchJson, Throttle } from "./http";

const CATEGORY = "Category:Nintendo_Switch_2-only_games";
const IGDB_GAME_ID = "P5794"; // Wikidata "Internet Game Database game ID" (the IGDB slug)

export interface WikiGame {
  title: string;
  wikidataId: string | null;
  igdbSlug: string | null;
}

interface CategoryResponse {
  continue?: Record<string, string>;
  query?: { pages?: { title: string; pageprops?: { wikibase_item?: string } }[] };
}

interface EntitiesResponse {
  entities: Record<string, { claims?: Record<string, { mainsnak: { datavalue?: { value: unknown } } }[]> }>;
}

/** Page title without disambiguation suffixes like " (video game)". */
export function cleanWikiTitle(title: string) {
  return title.replace(/\s*\((?:[^)]*\s)?video game\)$/i, "").trim();
}

/**
 * Members of the Wikipedia category, read through the MediaWiki API (not HTML),
 * with their IGDB slug from Wikidata when the item has one.
 */
export async function fetchSwitch2OnlyGames(userAgent: string): Promise<WikiGame[]> {
  const throttle = new Throttle(200);
  const headers = { "User-Agent": userAgent, "Api-User-Agent": userAgent };

  const pages: { title: string; qid: string | null }[] = [];
  let cont: Record<string, string> | undefined;
  do {
    const params = new URLSearchParams({
      action: "query",
      generator: "categorymembers",
      gcmtitle: CATEGORY,
      gcmnamespace: "0",
      gcmlimit: "500",
      prop: "pageprops",
      ppprop: "wikibase_item",
      format: "json",
      formatversion: "2",
      ...cont,
    });
    const res = await fetchJson<CategoryResponse>(`https://en.wikipedia.org/w/api.php?${params}`, {
      headers,
      throttle,
      label: "Wikipedia category",
    });
    for (const p of res.query?.pages ?? []) pages.push({ title: p.title, qid: p.pageprops?.wikibase_item ?? null });
    cont = res.continue;
  } while (cont);

  const slugByQid = new Map<string, string>();
  const qids = pages.map((p) => p.qid).filter((q): q is string => !!q);
  for (let i = 0; i < qids.length; i += 50) {
    const params = new URLSearchParams({
      action: "wbgetentities",
      ids: qids.slice(i, i + 50).join("|"),
      props: "claims",
      format: "json",
    });
    const res = await fetchJson<EntitiesResponse>(`https://www.wikidata.org/w/api.php?${params}`, {
      headers,
      throttle,
      label: "Wikidata entities",
    });
    for (const [qid, entity] of Object.entries(res.entities)) {
      const value = entity.claims?.[IGDB_GAME_ID]?.[0]?.mainsnak.datavalue?.value;
      if (typeof value === "string") slugByQid.set(qid, value);
    }
  }

  return pages.map((p) => ({
    title: p.title,
    wikidataId: p.qid,
    igdbSlug: (p.qid && slugByQid.get(p.qid)) || null,
  }));
}
