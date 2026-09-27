import { readJson } from "./cache";
import { ROOT } from "./env";
import { fetchJson, Throttle } from "./http";

/**
 * Nintendo's first-party studios from Nintendo Wiki (nintendo.fandom.com), read with the
 * MediaWiki API: members of Category:First_party_developers, then each page's categories
 * and infobox. Closed or merged studios are excluded; doubtful cases stay active.
 */

const FANDOM_API = "https://nintendo.fandom.com/api.php";
const CATEGORY = "Category:First_party_developers";

export const STUDIO_PATHS = {
  cache: `${ROOT}data/cache/studios.json`,
  overrides: `${ROOT}data/studios-overrides.json`,
};

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

/** data/studios-overrides.json: manual fixes, by Nintendo Wiki page title. */
export interface StudioOverride {
  /** Forces the studio active (true) or closed (false), whatever the wiki says. */
  active?: boolean;
  /** Developer names used on IGDB when they differ from the wiki title. */
  igdbNames?: string[];
  /** Never shown on the site. */
  hidden?: boolean;
  /** Why the override exists (free text, ignored by the scripts). */
  note?: string;
}

export type StudiosOverrides = Record<string, StudioOverride>;

export const loadStudiosOverrides = () => readJson<StudiosOverrides>(STUDIO_PATHS.overrides, {});

export const fandomUrl = (pageTitle: string) =>
  `https://nintendo.fandom.com/wiki/${encodeURIComponent(pageTitle.replace(/ /g, "_")).replace(/%2F/g, "/")}`;

const CLOSED = /defunct|former/i;

interface CategoryMembers {
  query?: { categorymembers?: { title: string; ns: number }[] };
  continue?: Record<string, string>;
}

interface PagesQuery {
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
    const res = await fetchJson<CategoryMembers>(`${FANDOM_API}?${params}`, { headers, throttle, label: "Nintendo Wiki category" });
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
      const res = await fetchJson<PagesQuery>(`${FANDOM_API}?${params}`, { headers, throttle, label: "Nintendo Wiki pages" });
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

  return titles
    .filter((t) => pages.has(t))
    .map((title) => {
      const { categories, content } = pages.get(title)!;
      const defunct = (content.match(/^\s*\|\s*defunct\s*=(.*)$/m)?.[1] ?? "").trim();
      const active = !categories.some((c) => CLOSED.test(c));
      return { title, url: fandomUrl(title), categories: [...new Set(categories)].sort(), defunct, active, uncertain: active && defunct !== "" };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}
