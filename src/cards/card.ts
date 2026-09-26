import type { Game, Region } from "../types";
import { MONTHS, parseDay } from "../timeline/dates";
import { shortDeveloper } from "./developer";
import { FLAGS } from "./flags";
import { createScoreRing, type ScoreRing } from "./score-ring";

/** Card widths in px; the collision layout needs them before any DOM exists. */
export const CARD_WIDTH = { game: 300, dlc: 264 } as const;

export function cardWidth(game: Game) {
  return game.kind === "dlc" ? CARD_WIDTH.dlc : CARD_WIDTH.game;
}

export interface Card {
  el: HTMLElement;
  rings: ScoreRing[];
}

const REGIONS: Region[] = ["JP", "EU", "NA"];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function shortDate(iso: string, refYear: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const base = `${MONTHS[m - 1].slice(0, 3)} ${d}`;
  return y === refYear ? base : `${base}, ${y}`;
}

function badges(game: Game) {
  const list: [string, string][] = [];
  if (game.kind === "switch2-edition") list.push(["Switch 2 Edition", "badge--s2"]);
  // Exclusivity describes the base game, so DLC cards don't repeat it.
  if (game.kind !== "dlc") {
    if (game.exclusivity === "exclusive") list.push(["Exclusive", "badge--accent"]);
    if (game.exclusivity === "timed") list.push(["Timed exclusive", "badge--accent-soft"]);
  }
  if (game.alsoOnSwitch1) list.push(["Also on Switch 1", ""]);
  const wrap = el("div", "card__badges");
  for (const [label, mod] of list) wrap.append(el("span", `badge ${mod}`.trim(), label));
  return wrap;
}

function metaLine(game: Game) {
  const p = el("p", "card__meta");
  if (game.developer) {
    const short = shortDeveloper(game.developer);
    const dev = el("span", "card__developer", short);
    if (short !== game.developer) {
      dev.title = game.developer;
      dev.setAttribute("aria-label", game.developer);
    }
    p.append(dev);
  }
  if (game.genres.length) p.append(`${game.developer ? " · " : ""}${game.genres.join(", ")}`);
  return p;
}

function regionalDates(game: Game) {
  const refYear = game.firstReleaseDate ? Number(game.firstReleaseDate.slice(0, 4)) : 0;
  const list = el("ul", "card__dates");
  for (const region of REGIONS) {
    const date = game.releaseDates[region];
    const item = el("li", "card__date");
    item.innerHTML = FLAGS[region];
    item.append(el("span", "card__date-region", region), el("span", date ? "" : "is-tba", date ? shortDate(date, refYear) : "TBA"));
    list.append(item);
  }
  return list;
}

function upcoming(game: Game, todayDay: number) {
  let when: string;
  if (game.firstReleaseDate) {
    const days = parseDay(game.firstReleaseDate) - todayDay;
    when = days === 1 ? "Tomorrow" : `In ${days} days`;
  } else {
    when = game.vagueRelease ? `Expected ${game.vagueRelease.label}` : "Date TBA";
  }
  const wrap = el("div", "card__upcoming");
  wrap.append(el("span", "card__upcoming-label", "Upcoming"), el("span", "card__upcoming-when", when));
  return wrap;
}

function scoreGroup(title: string, rings: ScoreRing[]) {
  const section = el("section", "score-group");
  const list = el("div", "score-group__rings");
  list.append(...rings.map((r) => r.el));
  section.append(el("h4", "score-group__title", title), list);
  return section;
}

export function createCard(game: Game, todayDay: number): Card {
  // TBA games (no precise date) are upcoming too.
  const isUpcoming = game.firstReleaseDate === null || parseDay(game.firstReleaseDate) > todayDay;

  const card = el("article", `card card--${game.kind}${isUpcoming ? " card--upcoming" : ""}`);
  card.style.width = `${cardWidth(game)}px`;
  card.dataset.gameId = game.id;
  card.setAttribute("aria-label", describe(game, isUpcoming));
  // Roving focus: the timeline makes the centered card (and its links) tabbable.
  card.tabIndex = -1;

  if (game.kind === "dlc") card.append(el("span", "card__ribbon", "DLC"));

  const top = el("div", "card__top");
  const cover = el("img", "card__cover");
  cover.src = game.coverUrl;
  cover.alt = "";
  cover.draggable = false;
  cover.loading = "lazy";

  const info = el("div", "card__info");
  info.append(el("h3", "card__title", game.title));
  if (game.kind === "dlc" && game.baseGameTitle) {
    const base = el("p", "card__base", "Expansion for ");
    base.append(el("em", undefined, game.baseGameTitle));
    info.append(base);
  }
  if (game.developer || game.genres.length) info.append(metaLine(game));
  info.append(badges(game));
  top.append(cover, info);
  card.append(top, regionalDates(game));

  const rings: ScoreRing[] = [];
  if (isUpcoming) {
    card.append(upcoming(game, todayDay));
  } else {
    const { critic, user } = game.scores;
    const { links } = game;
    const critics = [
      createScoreRing(critic.opencritic, "OpenCritic", links.opencritic, "reviews"),
      createScoreRing(critic.metacritic, "Metacritic", links.metacritic, "reviews"),
    ];
    const users = [
      createScoreRing(user.metacritic, "Metacritic", links.metacritic, "ratings"),
      createScoreRing(user.backloggd, "Backloggd", links.backloggd, "ratings"),
    ];
    rings.push(...critics, ...users);
    const scores = el("div", "card__scores");
    scores.append(scoreGroup("Critics", critics), scoreGroup("Users", users));
    card.append(scores);
  }

  card.querySelectorAll("a").forEach((a) => (a.tabIndex = -1));
  cover.addEventListener("error", () => (cover.src = PLACEHOLDER_COVER), { once: true });
  return { el: card, rings };
}

const PLACEHOLDER_COVER = `${import.meta.env.BASE_URL}covers/placeholder.svg`;

function longDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** One-line summary read by screen readers when the card gets focus. */
function describe(game: Game, isUpcoming: boolean) {
  const parts = [game.title];
  if (game.kind === "dlc") parts.push(game.baseGameTitle ? `DLC for ${game.baseGameTitle}` : "DLC");
  if (game.kind === "switch2-edition") parts.push("Nintendo Switch 2 Edition");
  if (game.firstReleaseDate) parts.push(`${isUpcoming ? "coming" : "released"} ${longDate(game.firstReleaseDate)}`);
  else parts.push(game.vagueRelease ? `expected ${game.vagueRelease.label}` : "release date to be announced");
  if (game.exclusivity === "exclusive") parts.push("exclusive");
  if (game.exclusivity === "timed") parts.push("timed exclusive");
  if (!isUpcoming) {
    const oc = game.scores.critic.opencritic;
    parts.push(oc ? `OpenCritic ${oc.value}` : "no OpenCritic score yet");
  }
  return parts.join(", ");
}
