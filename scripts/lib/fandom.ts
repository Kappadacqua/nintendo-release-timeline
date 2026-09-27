import { readJson } from "./cache";
import { PATHS } from "./env";
import { fetchJson, Throttle } from "./http";

/**
 * Nintendo's first-party studios from Nintendo Wiki (nintendo.fandom.com), read with the
 * MediaWiki API: members of Category:First_party_developers, then each page's categories
 * and infobox. Closed or merged studios are excluded; doubtful cases stay active.
 */

const FANDOM_API = "https://nintendo.fandom.com/api.php";
const CATEGORY = "Category:First_party_developers";

export interface FandomStudio {
  title: string;
  url: string;
  categories: string[];
  /** Infobox `defunct` field (raw wikitext, trimmed), empty when absent. */
  defunct: string;
  /** Computed from the categories: false when one contains "Defunct" or "Former". */
  active: boolean;
  /** Active by categories, but the infobox gives a defunct date: to check by hand. */
  uncertain: boolean;
}

/** data/cache/studios.json, written by data:fetch-studios. */
export interface StudiosCache {
  fetchedAt: string;
  source: string;
  studios: FandomStudio[];
}

/**
 * data/studios-overrides.json: manual fixes, by Nintendo Wiki page title. A key that is not a
 * wiki page names a partner or third-party studio: its "igdbNames" are merged under that name.
 */
export interface StudioOverride {
  /** Forces the studio active (true) or closed (false), whatever the wiki says. */
  active?: boolean;
  /** Developer names used on IGDB when they differ from the wiki title (or the studio name). */
  igdbNames?: string[];
  /** Never shown on the site. */
  hidden?: boolean;
  /** Why the override exists (free text, ignored by the scripts). */
  note?: string;
}

export type StudiosOverrides = Record<string, StudioOverride>;

export const loadStudiosOverrides = () => readJson<StudiosOverrides>(PATHS.studiosOverrides, {});

export const fandomUrl = (pageTitle: string) =>
  `https://nintendo.fandom.com/wiki/${encodeURIComponent(pageTitle.replace(/ /g, "_")).replace(/%2F/g, "/")}`;

const CLOSED = /defunct|former/i;

/** MediaWiki reports many errors (parameters, maxlag, limits) with HTTP 200 and this body. */
interface ApiError {
  error?: { code: string; info?: string };
}

/** The response, or an error when MediaWiki answered with `error`. */
function checked<T extends ApiError>(res: T, label: string): T {
  if (res.error) throw new Error(`${label}: MediaWiki error ${res.error.code}${res.error.info ? ` — ${res.error.info}` : ""}`);
  return res;
}

interface CategoryMembers extends ApiError {
  query?: { categorymembers?: { title: string; ns: number }[] };
  continue?: Record<string, string>;
}

interface PagesQuery extends ApiError {
  query?: {
    pages?: {
      title: string;
      missing?: boolean;
      categories?: { title: string }[];
      revisions?: { slots: { main: { content: string } } }[];
    }[];
  };
  continue?: Record<string, string>;
}

/** Every article (namespace 0) in Category:First_party_developers, with its state. */
export async function fetchFirstPartyStudios(userAgent: string): Promise<FandomStudio[]> {
  const throttle = new Throttle(250);
  const headers = { "User-Agent": userAgent };

  const titles: string[] = [];
  let next: Record<string, string> = {};
  do {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      list: "categorymembers",
      cmtitle: CATEGORY,
      cmnamespace: "0",
      cmlimit: "500",
      ...next,
    });
    const label = "Nintendo Wiki category";
    const res = checked(await fetchJson<CategoryMembers>(`${FANDOM_API}?${params}`, { headers, throttle, label }), label);
    titles.push(...(res.query?.categorymembers ?? []).map((m) => m.title));
    next = res.continue ?? {};
  } while (Object.keys(next).length);

  // Categories and the lead section (infobox) of up to 50 pages per call.
  const pages = new Map<string, { categories: string[]; content: string }>();
  for (let i = 0; i < titles.length; i += 50) {
    let cont: Record<string, string> = {};
    do {
      const params = new URLSearchParams({
        action: "query",
        format: "json",
        formatversion: "2",
        prop: "categories|revisions",
        cllimit: "max",
        rvprop: "content",
        rvslots: "main",
        rvsection: "0",
        titles: titles.slice(i, i + 50).join("|"),
        ...cont,
      });
      const label = "Nintendo Wiki pages";
      const res = checked(await fetchJson<PagesQuery>(`${FANDOM_API}?${params}`, { headers, throttle, label }), label);
      for (const p of res.query?.pages ?? []) {
        if (p.missing) continue;
        const page = pages.get(p.title) ?? { categories: [], content: "" };
        page.categories.push(...(p.categories ?? []).map((c) => c.title.replace(/^Category:/, "")));
        page.content ||= p.revisions?.[0]?.slots.main.content ?? "";
        pages.set(p.title, page);
      }
      cont = res.continue ?? {};
    } while (Object.keys(cont).length);
  }

  // A category member without its page means a failed or partial answer: never a smaller cache.
  const lost = titles.filter((t) => !pages.has(t));
  if (lost.length) throw new Error(`Nintendo Wiki pages: no data for ${lost.join(", ")}`);

  return titles
    .map((title) => {
      const { categories, content } = pages.get(title)!;
      const defunct = (content.match(/^\s*\|\s*defunct\s*=(.*)$/m)?.[1] ?? "").trim();
      const active = !categories.some((c) => CLOSED.test(c));
      return { title, url: fandomUrl(title), categories: [...new Set(categories)].sort(), defunct, active, uncertain: active && defunct !== "" };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}
