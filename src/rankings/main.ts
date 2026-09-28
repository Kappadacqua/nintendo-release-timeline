import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/header.css";
import "../styles/card.css";
import "../styles/loading.css";
import "../styles/filters.css";
import "../styles/rankings.css";
import { gsap } from "gsap";
import { createScoreRing, tier, type ScoreRing } from "../cards/score-ring";
import { applyFilters, FILTER_OPTIONS } from "../filters";
import { loadGames } from "../games";
import { initTheme } from "../theme/theme";
import { MONTHS, todayEpochDay } from "../timeline/dates";
import type { Game, ScoreSource } from "../types";
import { isReleased, rank, type Ranked, scoreOf, type Settings, SORTS, type SortKey } from "./rank";

initTheme(document.querySelector<HTMLButtonElement>(".theme-toggle")!);

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// ---------- Settings (SPEC §12) ----------

const DEFAULTS: Settings = { sort: "opencritic", minReviews: 20 };
const STORAGE_KEY = "rankings-settings";

function loadSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<Settings>;
    return {
      sort: SORTS.some((s) => s.key === saved.sort) ? saved.sort! : DEFAULTS.sort,
      minReviews: validMin(saved.minReviews) ?? DEFAULTS.minReviews,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings(s: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: settings last for this visit only */
  }
}

function validMin(v: unknown) {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null;
}

// ---------- Filters (SPEC §12), independent from the timeline's ----------

interface RankFilters {
  dlc: boolean;
  switch2Edition: boolean;
  exclusivesOnly: boolean;
  /** "all" or a release year. */
  year: string;
}

const FILTER_DEFAULTS: RankFilters = { dlc: false, switch2Edition: true, exclusivesOnly: false, year: "all" };
const FILTERS_KEY = "rankings-filters";

// Labels and hints come from the timeline filters, so the two pages never drift apart.
const TOGGLE_KEYS = ["dlc", "switch2Edition", "exclusivesOnly"] as const;
const TOGGLES = TOGGLE_KEYS.map((key) => ({ ...FILTER_OPTIONS.find((o) => o.key === key)!, key }));

function loadRankFilters(years: string[]): RankFilters {
  try {
    const saved = JSON.parse(localStorage.getItem(FILTERS_KEY) ?? "{}") as Partial<RankFilters>;
    const f = { ...FILTER_DEFAULTS };
    for (const { key } of TOGGLES) if (typeof saved[key] === "boolean") f[key] = saved[key];
    if (typeof saved.year === "string" && years.includes(saved.year)) f.year = saved.year;
    return f;
  } catch {
    return { ...FILTER_DEFAULTS };
  }
}

function saveRankFilters(f: RankFilters) {
  try {
    localStorage.setItem(FILTERS_KEY, JSON.stringify(f));
  } catch {
    /* storage unavailable: filters last for this visit only */
  }
}

const filtersAreDefault = (f: RankFilters) =>
  TOGGLES.every(({ key }) => f[key] === FILTER_DEFAULTS[key]) && f.year === FILTER_DEFAULTS.year;

/** Same kind / exclusivity rules as the timeline filters, plus the year. */
function filterGames(games: Game[], f: RankFilters) {
  const kept = applyFilters(games, { ...f, thirdParty: true, freeUpdates: false });
  return f.year === "all" ? kept : kept.filter((g) => g.firstReleaseDate!.startsWith(`${f.year}-`));
}

// ---------- Helpers ----------

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

// ---------- Rendering ----------

const RINGS: { source: ScoreSource; label: string; link: keyof Game["links"]; unit: "reviews" | "ratings" }[] = [
  { source: "opencritic", label: "OpenCritic", link: "opencritic", unit: "reviews" },
  { source: "metacritic", label: "Metacritic", link: "metacritic", unit: "reviews" },
  { source: "metacriticUser", label: "Metacritic", link: "metacritic", unit: "ratings" },
  { source: "backloggd", label: "Backloggd", link: "backloggd", unit: "ratings" },
];

function scoreGroup(title: string, rings: ScoreRing[]) {
  const section = el("section", "score-group");
  const list = el("div", "score-group__rings");
  list.append(...rings.map((r) => r.el));
  section.append(el("h3", "score-group__title", title), list);
  return section;
}

/** Average of the sources used, shown as a pill in the score tier color. */
function averagePill(entry: Ranked, label: string, sources: number) {
  const value = Math.round(entry.value);
  const pill = el("div", `rank-avg ring--${tier({ value, scale: 100, normalized: value, count: null })}`);
  // Only one source above the threshold: the "average" is that source's score (small, under the value).
  const partial = entry.used.length < sources ? `${entry.used.length} of ${sources} sources` : "";
  pill.append(el("span", "rank-avg__value", String(value)));
  if (partial) pill.append(el("span", "rank-avg__sources", partial));
  pill.append(el("span", "rank-avg__label", label));
  pill.setAttribute("aria-label", `${label}: ${value} out of 100${partial ? `, ${partial}` : ""}`);
  return pill;
}

function row(entry: Ranked, position: number, sort: SortKey) {
  const { game } = entry;
  const li = el("li", `rank-row rank-row--${game.kind}`);

  const pos = el("span", "rank-row__pos", String(position));
  pos.setAttribute("aria-label", `Rank ${position}`);

  const cover = el("img", "rank-row__cover");
  cover.src = game.coverUrl;
  cover.alt = "";
  cover.loading = "lazy";
  cover.decoding = "async";

  const info = el("div", "rank-row__info");
  const title = el("h2", "rank-row__title", game.title);
  const meta = el("p", "rank-row__meta");
  if (game.kind === "dlc") meta.append(el("span", "badge badge--dlc", "DLC"));
  if (game.kind === "switch2-edition") meta.append(el("span", "badge badge--s2", "Switch 2 Edition"));
  const date = el("time", "rank-row__date", formatDate(game.firstReleaseDate!));
  date.dateTime = game.firstReleaseDate!;
  meta.append(date);
  info.append(title, meta);

  const rings = RINGS.map(({ source, label, link, unit }) => {
    const ring = createScoreRing(scoreOf(game, source), label, game.links[link], unit);
    if (entry.used.includes(source)) ring.el.classList.add("is-sort");
    return ring;
  });
  const scores = el("div", "rank-row__scores");
  if (sort === "critics" || sort === "users") {
    const sources = SORTS.find((s) => s.key === sort)!.sources.length;
    scores.append(averagePill(entry, sort === "critics" ? "Critics avg" : "Users avg", sources));
  }
  scores.append(scoreGroup("Critics", rings.slice(0, 2)), scoreGroup("Users", rings.slice(2)));

  li.append(pos, cover, info, scores);
  return { li, rings };
}

function hiddenText(hidden: number, noCount: number, minReviews: number) {
  const games = `${hidden} ${hidden === 1 ? "game" : "games"} hidden`;
  if (minReviews === 0) return `${games} (no score)`;
  const reasons = `no score or fewer than ${minReviews} reviews`;
  return noCount > 0 ? `${games} (${reasons}; ${noCount} with no review count)` : `${games} (${reasons})`;
}

function filterBar(filters: RankFilters, years: string[], onChange: () => void) {
  const bar = el("div", "rank-filters");
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", "Filters");

  const inputs = TOGGLES.map(({ key, label, hint }) => {
    const option = el("label", "filters__option rank-filters__toggle");
    option.title = hint;
    const input = el("input", "");
    input.type = "checkbox";
    input.checked = filters[key];
    input.addEventListener("change", () => {
      filters[key] = input.checked;
      onChange();
    });
    option.append(input, el("span", "filters__switch"), el("strong", "", label));
    bar.append(option);
    return { key, input };
  });

  const yearGroup = el("div", "rank-years");
  yearGroup.setAttribute("role", "group");
  yearGroup.setAttribute("aria-label", "Release year");
  const yearButtons = ["all", ...years].map((year) => {
    const button = el("button", "", year === "all" ? "All" : year);
    button.type = "button";
    button.addEventListener("click", () => {
      if (filters.year === year) return;
      filters.year = year;
      sync();
      onChange();
    });
    yearGroup.append(button);
    return { year, button };
  });
  bar.append(yearGroup);

  /** Puts the controls back in line with `filters` (after a reset). */
  function sync() {
    for (const { key, input } of inputs) input.checked = filters[key];
    for (const { year, button } of yearButtons) button.setAttribute("aria-pressed", String(filters.year === year));
  }
  sync();
  return { bar, sync };
}

function controls(settings: Settings, onChange: () => void) {
  const form = el("form", "rankings__controls");
  form.addEventListener("submit", (e) => e.preventDefault());

  const sortField = el("label", "rank-field");
  const select = el("select", "rank-field__input");
  for (const s of SORTS) {
    const option = el("option", "", s.label);
    option.value = s.key;
    select.append(option);
  }
  select.value = settings.sort;
  select.addEventListener("change", () => {
    settings.sort = select.value as SortKey;
    onChange();
  });
  sortField.append(el("span", "rank-field__label", "Sort by"), select);

  const minField = el("label", "rank-field");
  const input = el("input", "rank-field__input rank-field__input--number");
  input.type = "number";
  input.min = "0";
  input.step = "1";
  input.inputMode = "numeric";
  input.value = String(settings.minReviews);
  input.addEventListener("input", () => {
    const v = validMin(input.valueAsNumber);
    if (v == null || v === settings.minReviews) return;
    settings.minReviews = v;
    onChange();
  });
  // An empty or invalid field snaps back to the value in use.
  input.addEventListener("blur", () => (input.value = String(settings.minReviews)));
  minField.append(el("span", "rank-field__label", "Min. reviews"), input);

  form.append(sortField, minField);
  return form;
}

function render(root: HTMLElement, games: Game[]) {
  const settings = loadSettings();
  // Free updates have no scores: never ranked, never counted among the hidden games.
  // One "today" for the whole visit (like the timeline): the released list, the years
  // and the ranking always agree, even across midnight.
  const today = todayEpochDay();
  const released = games.filter((g) => g.kind !== "free-update" && isReleased(g, today));
  const years = [...new Set(released.map((g) => g.firstReleaseDate!.slice(0, 4)))].sort();
  const filters = loadRankFilters(years);

  const page = el("section", "rankings");
  const head = el("header", "rankings__head");
  const heading = el("div", "rankings__heading");
  const subtitle = el("p", "rankings__subtitle");
  heading.append(el("h1", "rankings__title", "Rankings"), subtitle);
  const list = el("ol", "rankings__list");
  const hiddenEl = el("p", "rankings__hidden");
  const countEl = el("p", "rankings__count");
  countEl.setAttribute("aria-live", "polite");
  const empty = el("div", "rankings__empty");
  const emptyText = el("p", "rankings__empty-text");
  const resetButton = el("button", "rankings__reset", "Reset filters");
  resetButton.type = "button";
  empty.append(emptyText, resetButton);

  let rings: ScoreRing[] = [];
  let transition: gsap.core.Timeline | null = null;

  function fillList() {
    const { ranked, hidden, noCount } = rank(filterGames(released, filters), today, settings);
    const label = SORTS.find((s) => s.key === settings.sort)!.label;
    subtitle.textContent = `Released games by ${label} score`;
    const rows = ranked.map((entry, i) => row(entry, i + 1, settings.sort));
    list.replaceChildren(...rows.map((r) => r.li));
    rings = rows.flatMap((r) => r.rings);
    hiddenEl.textContent = hiddenText(hidden, noCount, settings.minReviews);
    hiddenEl.hidden = hidden === 0;
    countEl.textContent = `${ranked.length} ${ranked.length === 1 ? "game" : "games"} ranked`;
    // No match because of the filters (the defaults would rank something): offer a way back;
    // otherwise the threshold is the cause and the hidden line explains it.
    const filtered =
      ranked.length === 0 &&
      !filtersAreDefault(filters) &&
      rank(filterGames(released, FILTER_DEFAULTS), today, settings).ranked.length > 0;
    empty.hidden = ranked.length > 0;
    emptyText.textContent = filtered ? "No games match these filters" : "No games to rank";
    resetButton.hidden = !filtered;
  }

  function update() {
    saveSettings(settings);
    saveRankFilters(filters);
    transition?.progress(1).kill();
    fillList();
    // Rings jump straight to their value; a quick fade marks the change.
    for (const r of rings) r.finish();
    if (reducedMotion.matches) return;
    transition = gsap
      .timeline()
      .fromTo(list, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.22, ease: "power2.out", clearProps: "all" });
  }

  const filterControls = filterBar(filters, years, update);
  resetButton.addEventListener("click", () => {
    Object.assign(filters, FILTER_DEFAULTS);
    filterControls.sync();
    update();
  });
  const toolbar = el("div", "rankings__toolbar");
  toolbar.append(filterControls.bar, countEl);

  head.append(heading, controls(settings, update));
  page.append(head, toolbar, list, empty, hiddenEl);
  root.append(page);
  fillList();

  if (reducedMotion.matches) {
    for (const r of rings) r.finish();
    return;
  }
  const tl = gsap.timeline();
  tl.from(list.children, { autoAlpha: 0, y: 10, duration: 0.35, ease: "power2.out", stagger: 0.03 }, 0);
  [...list.children].forEach((_, i) => {
    for (const r of rings.slice(i * RINGS.length, (i + 1) * RINGS.length)) tl.add(r.fill(), 0.1 + i * 0.03);
  });
  transition = tl;
}

const app = document.querySelector<HTMLElement>("#app")!;
const status = app.querySelector<HTMLElement>(".app-status")!;
loadGames()
  .then((games) => {
    status.remove();
    render(app, games);
  })
  .catch((err: unknown) => {
    status.textContent = `Couldn't load the games (${err instanceof Error ? err.message : String(err)}).`;
    status.classList.add("app-status--error");
  })
  .finally(() => app.removeAttribute("aria-busy"));
