import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/header.css";
import "../styles/card.css";
import "../styles/loading.css";
import "../styles/filters.css";
import "../styles/studios.css";
import { gsap } from "gsap";
import { initTheme } from "../theme/theme";
import { MONTHS, parseDay, todayEpochDay } from "../timeline/dates";
import type { Studio, StudioCategory, StudioGame, StudiosFile } from "../types";

initTheme(document.querySelector<HTMLButtonElement>(".theme-toggle")!);

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// ---------- Setting: third-party studios (SPEC §14) ----------

const THIRD_PARTY_KEY = "studios-show-third-party";

function loadShowThirdParty() {
  try {
    return localStorage.getItem(THIRD_PARTY_KEY) === "true";
  } catch {
    return false;
  }
}

function saveShowThirdParty(show: boolean) {
  try {
    localStorage.setItem(THIRD_PARTY_KEY, String(show));
  } catch {
    /* storage unavailable: the choice lasts for this visit only */
  }
}

// ---------- Helpers ----------

const CATEGORY_LABEL: Record<StudioCategory, string> = {
  "first-party": "First party",
  partner: "Partner",
  "third-party": "Third party",
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/** "Jun 5, 2025" */
function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1].slice(0, 3)} ${d}, ${y}`;
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

/** Same spans as the timeline cards: days, then months, then years. */
function span(days: number) {
  if (days < 60) return plural(days, "day");
  const months = Math.round(days / 30.44);
  return months < 24 ? plural(months, "month") : plural(Math.round(days / 365.25), "year");
}

/** "Upcoming · in 26 days", "Out today", "Released 3 months ago" — from the date, not the build's status. */
function relative(days: number) {
  if (days === 0) return "Out today";
  if (days === 1) return "Upcoming · tomorrow";
  if (days === -1) return "Released yesterday";
  return days > 0 ? `Upcoming · in ${span(days)}` : `Released ${span(-days)} ago`;
}

/** The Switch 2 game on the card: none for studios without one (their game is a Switch 1 game). */
const shownGame = (s: Studio) => (s.hasSwitch2Game ? s.game : null);

/** Upcoming (nearest first), then released (latest first), then no game (alphabetical). */
function sortStudios(studios: Studio[], today: number) {
  const key = (s: Studio) => {
    const game = shownGame(s);
    if (!game) return { group: 2, day: 0 };
    const day = parseDay(game.date);
    return day >= today ? { group: 0, day } : { group: 1, day: -day };
  };
  return [...studios].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    return ka.group - kb.group || ka.day - kb.day || a.name.localeCompare(b.name);
  });
}

// ---------- Rendering ----------

function gameBlock(game: StudioGame, today: number) {
  const days = parseDay(game.date) - today;
  const block = el("div", `studio-game${days >= 0 ? " is-upcoming" : ""}`);

  const cover = el("img", "studio-game__cover");
  cover.src = game.coverUrl;
  cover.alt = "";
  cover.loading = "lazy";
  cover.decoding = "async";

  const info = el("div", "studio-game__info");
  const date = el("time", "studio-game__date", formatDate(game.date));
  date.dateTime = game.date;
  info.append(
    el("h3", "studio-game__title", game.title),
    date,
    el("p", "studio-game__status", relative(days)),
  );
  block.append(cover, info);
  return block;
}

/** No Switch 2 game in the dataset, or one without a precise date. */
function noGameBlock(studio: Studio) {
  const block = el("div", "studio-none");
  block.append(el("p", "studio-none__text", studio.hasSwitch2Game ? "Release date TBA" : "No Switch 2 game yet"));
  if (!studio.hasSwitch2Game && studio.latestSwitch1Game) {
    block.append(el("p", "studio-none__latest", `Latest: ${studio.latestSwitch1Game.title} · Switch 1`));
  }
  return block;
}

function card(studio: Studio, today: number) {
  const li = el("li", `studio-card studio-card--${studio.category}`);

  const head = el("header", "studio-card__head");
  const name = el("h2", "studio-card__name");
  if (studio.url) {
    const link = el("a", "studio-card__link", studio.name);
    link.href = studio.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.title = "Open on Nintendo Wiki";
    name.append(link);
  } else {
    name.textContent = studio.name;
  }
  head.append(name, el("span", `badge studio-badge studio-badge--${studio.category}`, CATEGORY_LABEL[studio.category]));

  const game = shownGame(studio);
  li.append(head, game ? gameBlock(game, today) : noGameBlock(studio));
  return li;
}

function render(root: HTMLElement, studios: Studio[]) {
  const today = todayEpochDay();
  const sorted = sortStudios(studios, today);
  let showThirdParty = loadShowThirdParty();

  const page = el("section", "studios");
  const head = el("header", "studios__head");
  const heading = el("div", "studios__heading");
  heading.append(
    el("h1", "studios__title", "Studios"),
    el("p", "studios__subtitle", "Nintendo's studios and partners, and their next or latest Switch 2 game"),
  );

  const toggle = el("label", "filters__option studios__toggle");
  toggle.title = "Studios with exclusives published by other companies";
  const input = el("input", "");
  input.type = "checkbox";
  input.checked = showThirdParty;
  toggle.append(input, el("span", "filters__switch"), el("strong", "", "Show third-party studios"));

  const countEl = el("p", "studios__count");
  countEl.setAttribute("aria-live", "polite");
  const toolbar = el("div", "studios__toolbar");
  toolbar.append(toggle, countEl);
  head.append(heading, toolbar);

  const list = el("ol", "studios__list");
  const empty = el("p", "studios__empty", "No studios to show");
  let transition: gsap.core.Tween | null = null;

  function fillList() {
    const visible = sorted.filter((s) => showThirdParty || s.category !== "third-party");
    list.replaceChildren(...visible.map((s) => card(s, today)));
    countEl.textContent = `${visible.length} ${visible.length === 1 ? "studio" : "studios"}`;
    empty.hidden = visible.length > 0;
  }

  input.addEventListener("change", () => {
    showThirdParty = input.checked;
    saveShowThirdParty(showThirdParty);
    transition?.progress(1).kill();
    fillList();
    if (reducedMotion.matches) return;
    transition = gsap.fromTo(
      list,
      { autoAlpha: 0, y: 6 },
      { autoAlpha: 1, y: 0, duration: 0.22, ease: "power2.out", clearProps: "all" },
    );
  });

  page.append(head, list, empty);
  root.append(page);
  fillList();

  if (reducedMotion.matches) return;
  transition = gsap.from(list.children, { autoAlpha: 0, y: 10, duration: 0.35, ease: "power2.out", stagger: 0.02 });
}

async function loadStudios(): Promise<Studio[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/studios.json`);
  if (!res.ok) throw new Error(`studios.json: HTTP ${res.status}`);
  const data = (await res.json()) as StudiosFile;
  return data.studios;
}

const app = document.querySelector<HTMLElement>("#app")!;
const status = app.querySelector<HTMLElement>(".app-status")!;
loadStudios()
  .then((studios) => {
    status.remove();
    render(app, studios);
  })
  .catch((err: unknown) => {
    status.textContent = `Couldn't load the studios (${err instanceof Error ? err.message : String(err)}).`;
    status.classList.add("app-status--error");
  })
  .finally(() => app.removeAttribute("aria-busy"));
