import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/header.css";
import "../styles/card.css";
import "../styles/loading.css";
import "../styles/rankings.css";
import { gsap } from "gsap";
import { createScoreRing } from "../cards/score-ring";
import { loadGames } from "../games";
import { initTheme } from "../theme/theme";
import { MONTHS, parseDay, todayEpochDay } from "../timeline/dates";
import type { Game, Score } from "../types";

/** Minimum OpenCritic reviews to be ranked (fixed for now, SPEC §12). */
const MIN_REVIEWS = 20;

initTheme(document.querySelector<HTMLButtonElement>(".theme-toggle")!);

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function isReleased(game: Game, today: number) {
  return game.firstReleaseDate != null && parseDay(game.firstReleaseDate) <= today;
}

/** "Jun 5, 2025" */
function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1].slice(0, 3)} ${d}, ${y}`;
}

type Ranked = { game: Game; score: Score };

/** Released games with at least MIN_REVIEWS OpenCritic reviews, best first. */
function rank(games: Game[], today: number) {
  const released = games.filter((g) => isReleased(g, today));
  const ranked: Ranked[] = [];
  for (const game of released) {
    const score = game.scores.critic.opencritic;
    if (score && (score.count ?? 0) >= MIN_REVIEWS) ranked.push({ game, score });
  }
  // Ties: more reviews first, then title.
  ranked.sort(
    (a, b) =>
      b.score.value - a.score.value ||
      (b.score.count ?? 0) - (a.score.count ?? 0) ||
      a.game.title.localeCompare(b.game.title),
  );
  return { ranked, hidden: released.length - ranked.length };
}

function row({ game, score }: Ranked, position: number) {
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

  const ring = createScoreRing(score, "OpenCritic", game.links.opencritic, "reviews");
  ring.el.classList.add("rank-row__ring");

  li.append(pos, cover, info, ring.el);
  return { li, ring };
}

function render(root: HTMLElement, games: Game[]) {
  const { ranked, hidden } = rank(games, todayEpochDay());

  const page = el("section", "rankings");
  const head = el("header", "rankings__head");
  head.append(el("h1", "rankings__title", "Rankings"), el("p", "rankings__subtitle", "Released games by OpenCritic score"));

  const list = el("ol", "rankings__list");
  const rows = ranked.map((entry, i) => row(entry, i + 1));
  list.append(...rows.map((r) => r.li));
  page.append(head, list);
  if (hidden > 0) {
    page.append(el("p", "rankings__hidden", `${hidden} ${hidden === 1 ? "game" : "games"} hidden (fewer than ${MIN_REVIEWS} reviews)`));
  }
  root.append(page);

  if (reducedMotion.matches) {
    for (const r of rows) r.ring.finish();
    return;
  }
  const tl = gsap.timeline();
  tl.from(list.children, { autoAlpha: 0, y: 10, duration: 0.35, ease: "power2.out", stagger: 0.03 }, 0);
  rows.forEach((r, i) => tl.add(r.ring.fill(), 0.1 + i * 0.03));
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
