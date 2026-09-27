import { fetchJson, Throttle } from "./http";

// Verified: https://www.igdb.com/platforms/switch-2 → 508, Switch → 130.
export const PLATFORM = { SWITCH: 130, SWITCH_2: 508 } as const;

export const IMAGE_URL = (imageId: string, size = "cover_big") =>
  `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;

/**
 * Fields requested for every game. Uses the post-2025 table fields
 * (`game_type`, `release_region`, `date_format`) expanded to their names,
 * instead of the deprecated enums (`category`, `region`).
 */
export const GAME_FIELDS = [
  "name",
  "slug",
  "first_release_date",
  "platforms",
  "game_type.type",
  "parent_game.name",
  "version_parent",
  "cover.image_id",
  "summary",
  "artworks.image_id",
  "artworks.artwork_type",
  "artworks.width",
  "artworks.height",
  "artworks.alpha_channel",
  "screenshots.image_id",
  "screenshots.width",
  "screenshots.height",
  "websites.url",
  "websites.type.type",
  "genres.name",
  "involved_companies.company.name",
  "involved_companies.developer",
  "involved_companies.publisher",
  "release_dates.date",
  "release_dates.y",
  "release_dates.platform",
  "release_dates.date_format.format",
  "release_dates.release_region.region",
].join(",");

export interface IgdbReleaseDate {
  date?: number; // unix seconds
  y?: number;
  platform?: number;
  date_format?: { format?: string };
  release_region?: { region?: string };
}

export interface IgdbGame {
  id: number;
  name: string;
  slug: string;
  first_release_date?: number;
  platforms?: number[];
  game_type?: { type?: string };
  parent_game?: { id: number; name?: string };
  version_parent?: number;
  cover?: { image_id?: string };
  summary?: string;
  /** artwork_type: 1 artwork, 2 key art without logo, 3 key art with logo, 4 concept art, 5–15 logos, covers, icons… */
  artworks?: { image_id?: string; artwork_type?: number; width?: number; height?: number; alpha_channel?: boolean }[];
  screenshots?: { image_id?: string; width?: number; height?: number }[];
  websites?: { url?: string; type?: { type?: string } }[];
  genres?: { name: string }[];
  involved_companies?: { company?: { name?: string }; developer?: boolean; publisher?: boolean }[];
  release_dates?: IgdbReleaseDate[];
}

const MAX_LIMIT = 500;

export class Igdb {
  // 4 requests/second allowed; keep a small margin.
  private readonly throttle = new Throttle(280);

  private constructor(
    private readonly clientId: string,
    private readonly token: string,
  ) {}

  /** Twitch client-credentials flow. */
  static async connect(clientId: string, clientSecret: string) {
    const url = new URL("https://id.twitch.tv/oauth2/token");
    url.search = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }).toString();
    const { access_token } = await fetchJson<{ access_token: string }>(url.toString(), {
      method: "POST",
      label: "Twitch auth",
    });
    return new Igdb(clientId, access_token);
  }

  query<T>(endpoint: string, body: string): Promise<T[]> {
    return fetchJson<T[]>(`https://api.igdb.com/v4/${endpoint}`, {
      method: "POST",
      headers: {
        "Client-ID": this.clientId,
        Authorization: `Bearer ${this.token}`,
        Accept: "application/json",
        "Content-Type": "text/plain",
      },
      body,
      throttle: this.throttle,
      label: `IGDB ${endpoint}`,
    });
  }

  /** Pages through every result; `body` must not contain limit/offset. */
  /** Pages through every result; `sort id` keeps offset paging stable (unsorted pages skip and repeat rows). */
  async queryAll<T>(endpoint: string, body: string): Promise<T[]> {
    const all: T[] = [];
    for (let offset = 0; ; offset += MAX_LIMIT) {
      const page = await this.query<T>(endpoint, `${body} sort id asc; limit ${MAX_LIMIT}; offset ${offset};`);
      all.push(...page);
      if (page.length < MAX_LIMIT) return all;
    }
  }

  /** Runs `where` against chunks of ids, e.g. `where id = (…) & …`. */
  async gamesWhereIds(ids: number[], field: string, extraWhere = ""): Promise<IgdbGame[]> {
    const out: IgdbGame[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200).join(",");
      const where = `${field} = (${chunk})${extraWhere ? ` & ${extraWhere}` : ""}`;
      out.push(...(await this.queryAll<IgdbGame>("games", `fields ${GAME_FIELDS}; where ${where};`)));
    }
    return out;
  }

  gamesBySlugs(slugs: string[]): Promise<IgdbGame[]> {
    if (!slugs.length) return Promise.resolve([]);
    const list = slugs.map((s) => JSON.stringify(s)).join(",");
    return this.queryAll<IgdbGame>("games", `fields ${GAME_FIELDS}; where slug = (${list});`);
  }

  /** Best text-search match among Switch / Switch 2 games. */
  async searchSwitchGame(title: string): Promise<IgdbGame | undefined> {
    const [hit] = await this.query<IgdbGame>(
      "games",
      `search ${JSON.stringify(title)}; fields ${GAME_FIELDS}; where platforms = (${PLATFORM.SWITCH},${PLATFORM.SWITCH_2}); limit 1;`,
    );
    return hit;
  }
}
