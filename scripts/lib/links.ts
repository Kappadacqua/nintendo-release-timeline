import { fetchJson, Throttle } from "./http";
import { sameTitle } from "./transform";

const IGDB_GAME_ID = "P5794"; // Wikidata "Internet Game Database game ID" (the IGDB slug)
const FANDOM_API = "https://nintendo.fandom.com/api.php";

export interface WikidataLinks {
  wikipedia?: string;
  /** Nintendo eShop (Europe) id, P12418: https://www.nintendo.co.uk/-/-<id>.html */
  eshopEu?: string;
  /** Nintendo eShop id, P8084: https://www.nintendo.com/us/store/products/<id>/ */
  eshopUs?: string;
}

/** Wikidata per IGDB slug: English Wikipedia article and eShop ids (one SPARQL query per 100 slugs). */
export async function wikidataBySlug(slugs: string[], userAgent: string): Promise<Map<string, WikidataLinks>> {
  const out = new Map<string, WikidataLinks>();
  const throttle = new Throttle(1000);
  for (let i = 0; i < slugs.length; i += 100) {
    const values = slugs
      .slice(i, i + 100)
      .map((s) => JSON.stringify(s))
      .join(" ");
    const query = `SELECT ?slug ?article ?eu ?us WHERE {
      VALUES ?slug { ${values} }
      ?item wdt:${IGDB_GAME_ID} ?slug .
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
      OPTIONAL { ?item wdt:P12418 ?eu . }
      OPTIONAL { ?item wdt:P8084 ?us . }
    }`;
    type Binding = Record<"slug" | "article" | "eu" | "us", { value: string } | undefined>;
    const res = await fetchJson<{ results: { bindings: Binding[] } }>("https://query.wikidata.org/sparql", {
      method: "POST",
      headers: {
        "User-Agent": userAgent,
        Accept: "application/sparql-results+json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ query }).toString(),
      throttle,
      label: "Wikidata SPARQL",
    });
    for (const b of res.results.bindings) {
      const slug = b.slug!.value;
      const cur = out.get(slug) ?? {};
      cur.wikipedia ??= b.article?.value;
      cur.eshopEu ??= b.eu?.value;
      cur.eshopUs ??= b.us?.value;
      out.set(slug, cur);
    }
  }
  return out;
}

/** English Wikipedia article for exact titles (redirects followed, disambiguation pages skipped). */
export async function wikipediaByTitle(titles: string[], userAgent: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const throttle = new Throttle(200);
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      redirects: "1",
      prop: "pageprops",
      ppprop: "disambiguation",
      titles: batch.join("|"),
    });
    const res = await fetchJson<WikiQuery>(
      `https://en.wikipedia.org/w/api.php?${params}`,
      { headers: { "User-Agent": userAgent, "Api-User-Agent": userAgent }, throttle, label: "Wikipedia titles" },
    );
    const q = res.query ?? {};
    const follow = (t: string, list?: { from: string; to: string }[]) => list?.find((x) => x.from === t)?.to ?? t;
    const ok = new Set((q.pages ?? []).filter((p) => !p.missing && !p.pageprops).map((p) => p.title));
    for (const title of batch) {
      const page = follow(follow(title, q.normalized), q.redirects);
      if (ok.has(page)) out.set(title, wikipediaUrl(page));
    }
  }
  return out;
}

/** "Kirby and the Forgotten Land – Nintendo Switch 2 Edition + Star-Crossed World" → "Kirby and the Forgotten Land". */
export function baseTitleOfEdition(title: string) {
  const base = title.replace(/\s*[:\-–—]?\s*Nintendo Switch 2 Edition.*$/i, "").trim();
  return base && base !== title ? base : null;
}

export function wikipediaUrl(pageTitle: string) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, "_")).replace(/%2F/g, "/")}`;
}

const fandomUrl = (pageTitle: string) =>
  `https://nintendo.fandom.com/wiki/${encodeURIComponent(pageTitle.replace(/ /g, "_")).replace(/%2F/g, "/")}`;

type WikiQuery = {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: { title: string; missing?: boolean; pageprops?: object }[];
  };
};

interface FandomQuery {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: { title: string; missing?: boolean }[];
    search?: { title: string }[];
  };
}

/**
 * Nintendo Wiki (nintendo.fandom.com) page per game title: exact title (or a redirect
 * the wiki defines), else a search accepted only on a normalized-title match.
 * When in doubt there is no link.
 */
export async function nintendoWikiByTitle(titles: string[], userAgent: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const throttle = new Throttle(250);
  const headers = { "User-Agent": userAgent };
  const missing: string[] = [];

  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      redirects: "1",
      titles: batch.join("|"),
    });
    const res = await fetchJson<FandomQuery>(`${FANDOM_API}?${params}`, { headers, throttle, label: "Nintendo Wiki titles" });
    const q = res.query ?? {};
    const follow = (t: string, list?: { from: string; to: string }[]) => list?.find((x) => x.from === t)?.to ?? t;
    const found = new Set((q.pages ?? []).filter((p) => !p.missing).map((p) => p.title));
    for (const title of batch) {
      const page = follow(follow(title, q.normalized), q.redirects);
      if (found.has(page)) out.set(title, fandomUrl(page));
      else missing.push(title);
    }
  }

  for (const title of missing) {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      list: "search",
      srlimit: "5",
      srsearch: title,
    });
    const res = await fetchJson<FandomQuery>(`${FANDOM_API}?${params}`, { headers, throttle, label: "Nintendo Wiki search" });
    const hit = (res.query?.search ?? []).find((s) => sameTitle(s.title, title));
    if (hit) out.set(title, fandomUrl(hit.title));
  }
  return out;
}
