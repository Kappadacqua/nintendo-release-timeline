import type { Game, Region } from "../../src/types";
import { IMAGE_URL, type IgdbGame, PLATFORM } from "./igdb";

export const START_DATE = "2025-06-05";
const PLACEHOLDER_COVER = "covers/placeholder.svg";
const SWITCH_PLATFORMS: number[] = [PLATFORM.SWITCH, PLATFORM.SWITCH_2];

const REGION_MAP: Record<string, Region[]> = {
  japan: ["JP"],
  europe: ["EU"],
  north_america: ["NA"],
  worldwide: ["JP", "EU", "NA"],
};

// IGDB genre names are long; the card has little room.
const GENRE_NAMES: Record<string, string> = {
  "Role-playing (RPG)": "RPG",
  "Hack and slash/Beat 'em up": "Hack and slash",
  "Real Time Strategy (RTS)": "RTS",
  "Turn-based strategy (TBS)": "Strategy",
  "Point-and-click": "Point & click",
  "Card & Board Game": "Card & board",
  "Quiz/Trivia": "Quiz",
};

/** Loose title comparison: case, accents, punctuation and dashes ignored. */
export function sameTitle(a: string, b: string) {
  const norm = (s: string) =>
    s.toLowerCase().replace(/&/g, " and ").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  return norm(a) === norm(b);
}

const key = (s: string | undefined) => (s ?? "").toLowerCase().replace(/[^a-z]/g, "");

/** IGDB game types left out of the timeline (bundles, updates, mods…). */
const EXCLUDED_TYPES = new Set(["bundle", "pack", "update", "mod", "fork", "episode", "season"]);

export function isExcludedType(g: IgdbGame) {
  return EXCLUDED_TYPES.has(key(g.game_type?.type));
}

export function kindOf(g: IgdbGame): Game["kind"] {
  if (/nintendo switch 2 edition/i.test(g.name)) return "switch2-edition";
  const type = key(g.game_type?.type);
  if (type === "dlc" || type === "dlcaddon" || type === "expansion") return "dlc";
  return "game";
}

const isoDay = (unixSeconds: number) => new Date(unixSeconds * 1000).toISOString().slice(0, 10);

interface Dates {
  releaseDates: Game["releaseDates"];
  firstReleaseDate: string | null;
  vagueRelease?: Game["vagueRelease"];
  /** Only a "TBD" date (not even a year). */
  fullyUnknown: boolean;
}

// The date_formats table says "YYYYMMDD" / "YYYYMM"; the legacy enum said "YYYYMMMMDD" / "YYYYMMMM".
const DAY_FORMATS = new Set(["YYYYMMDD", "YYYYMMMMDD"]);
const MONTH_FORMATS = new Set(["YYYYMM", "YYYYMMMM"]);

/** Regional dates from Switch / Switch 2 release entries; region-specific dates beat "worldwide". */
export function releaseInfo(g: IgdbGame): Dates {
  const entries = (g.release_dates ?? []).filter((r) => r.platform === undefined || SWITCH_PLATFORMS.includes(r.platform));
  const precise: Partial<Record<Region, { date: string; specific: boolean }>> = {};
  const vague: { year: number | null; label: string }[] = [];

  for (const r of entries) {
    const format = r.date_format?.format ?? "";
    const regionName = r.release_region?.region ?? "worldwide";
    const regions = REGION_MAP[regionName] ?? [];
    const specific = regionName !== "worldwide";

    if (DAY_FORMATS.has(format) && r.date) {
      const date = isoDay(r.date);
      for (const region of regions) {
        const cur = precise[region];
        const better = !cur || (specific && !cur.specific) || (specific === cur.specific && date < cur.date);
        if (better) precise[region] = { date, specific };
      }
    } else if (r.y) {
      const quarter = /^YYYYQ([1-4])$/.exec(format)?.[1];
      const month = MONTH_FORMATS.has(format) && r.date ? new Date(r.date * 1000).toLocaleString("en", { month: "short", timeZone: "UTC" }) : null;
      vague.push({ year: r.y, label: quarter ? `Q${quarter} ${r.y}` : month ? `${month} ${r.y}` : String(r.y) });
    } else {
      vague.push({ year: null, label: "TBA" });
    }
  }

  // No release entries at all: fall back to the game's own first release date.
  if (!entries.length && g.first_release_date) {
    const date = isoDay(g.first_release_date);
    for (const region of ["JP", "EU", "NA"] as Region[]) precise[region] = { date, specific: false };
  }

  const releaseDates: Game["releaseDates"] = {};
  for (const region of ["JP", "EU", "NA"] as Region[]) releaseDates[region] = precise[region]?.date ?? null;
  const known = Object.values(releaseDates).filter((d): d is string => !!d).sort();
  const firstReleaseDate = known[0] ?? null;

  if (firstReleaseDate) return { releaseDates, firstReleaseDate, fullyUnknown: false };
  const withYear = vague.filter((v) => v.year !== null).sort((a, b) => a.year! - b.year!)[0];
  return {
    releaseDates,
    firstReleaseDate: null,
    vagueRelease: withYear ? { year: withYear.year!, label: withYear.label } : undefined,
    fullyUnknown: !withYear,
  };
}

/** In the perimeter by date: released/dated from the start date on, or announced for a year ≥ start year. */
export function inDateRange(g: IgdbGame, info: Dates) {
  // SPEC §3: the game's first release on any platform, not just the Switch one
  // (keeps out old games that got a new Switch release, e.g. 2004 GBA titles in 2026).
  if (g.first_release_date && isoDay(g.first_release_date) < START_DATE) return false;
  if (info.firstReleaseDate) return info.firstReleaseDate >= START_DATE;
  if (info.vagueRelease) return info.vagueRelease.year >= Number(START_DATE.slice(0, 4));
  // "TBD" only for Switch 2 games, so old never-released Switch entries stay out.
  return info.fullyUnknown && (g.platforms ?? []).includes(PLATFORM.SWITCH_2);
}

export function isOnSwitch(g: IgdbGame) {
  return (g.platforms ?? []).some((p) => SWITCH_PLATFORMS.includes(p));
}

/** True when every platform is Switch or Switch 2 (covers cross-gen Nintendo releases). */
export function igdbExclusive(g: IgdbGame) {
  const platforms = g.platforms ?? [];
  return platforms.length > 0 && platforms.every((p) => SWITCH_PLATFORMS.includes(p));
}

export function publishers(g: IgdbGame) {
  return (g.involved_companies ?? []).filter((c) => c.publisher).map((c) => c.company?.name ?? "");
}

/** Game record before scores, overrides and exclusivity history. */
export function toGame(g: IgdbGame, info: Dates): Game {
  const developer = (g.involved_companies ?? []).find((c) => c.developer)?.company?.name ?? null;
  const genres = (g.genres ?? []).map((x) => GENRE_NAMES[x.name] ?? x.name).slice(0, 2);
  const kind = kindOf(g);
  const platforms = g.platforms ?? [];

  return {
    id: `igdb:${g.id}`,
    kind,
    title: g.name,
    ...(kind === "dlc" && g.parent_game?.name ? { baseGameTitle: g.parent_game.name } : {}),
    coverUrl: g.cover?.image_id ? IMAGE_URL(g.cover.image_id) : PLACEHOLDER_COVER,
    developer,
    genres,
    releaseDates: info.releaseDates,
    firstReleaseDate: info.firstReleaseDate,
    ...(info.vagueRelease ? { vagueRelease: info.vagueRelease } : {}),
    exclusivity: null,
    alsoOnSwitch1: platforms.includes(PLATFORM.SWITCH) && platforms.includes(PLATFORM.SWITCH_2),
    scores: { critic: { opencritic: null, metacritic: null }, user: { metacritic: null, backloggd: null } },
    // Backloggd is built on IGDB, so its URLs use the IGDB slug.
    links: { backloggd: `https://backloggd.com/games/${g.slug}/` },
  };
}
