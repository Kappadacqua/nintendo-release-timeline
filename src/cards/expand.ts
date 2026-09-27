import { gsap } from "gsap";
import { parseDay } from "../timeline/dates";
import type { Game, ScoreSource } from "../types";

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

/**
 * Reference links shown as buttons in the selected card, on one row: `short` is the
 * visible text where the full name doesn't fit (the full one stays in tooltip and aria-label).
 */
const LINK_BUTTONS: { key: keyof Game["links"]; label: string; short?: string }[] = [
  { key: "wikipedia", label: "Wikipedia" },
  { key: "nintendoWiki", label: "Nintendo Wiki" },
  { key: "nintendoStore", label: "Nintendo Store", short: "Store" },
];

function plural(n: number, unit: string) {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

function span(days: number) {
  if (days < 60) return plural(days, "day");
  const months = Math.round(days / 30.44);
  return months < 24 ? plural(months, "month") : plural(Math.round(days / 365.25), "year");
}

/** "Out in 12 days", "Out today", "Released 3 days ago" (first release, local time zone). */
export function relativeRelease(game: Game, todayDay: number) {
  if (!game.firstReleaseDate) return game.vagueRelease ? `Expected ${game.vagueRelease.label}` : "Release date TBA";
  const days = parseDay(game.firstReleaseDate) - todayDay;
  if (days === 0) return "Out today";
  if (days === 1) return "Out tomorrow";
  if (days === -1) return "Released yesterday";
  return days > 0 ? `Out in ${span(days)}` : `Released ${span(-days)} ago`;
}

function linkButton(label: string, href: string | undefined, short = label) {
  if (!href) {
    const off = document.createElement("span");
    off.className = "card-button is-disabled";
    off.setAttribute("aria-disabled", "true");
    off.title = `No ${label} page`;
    off.setAttribute("aria-label", `${label}: no page`);
    off.textContent = short;
    return off;
  }
  const a = document.createElement("a");
  a.className = "card-button";
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = short;
  a.title = label;
  a.setAttribute("aria-label", `${label} (opens in a new tab)`);
  return a;
}

/** Extra content of the selected card: relative time, summary, reference buttons. */
function buildMore(card: HTMLElement, game: Game, todayDay: number) {
  const more = document.createElement("div");
  more.className = "card__more";

  // Upcoming cards already have a band ("UPCOMING … In 26 days"): the relative time goes
  // there (see expandCard); released games get their own line.
  if (!card.querySelector(".card__upcoming")) {
    const when = document.createElement("p");
    when.className = "card__when";
    when.textContent = relativeRelease(game, todayDay);
    more.append(when);
  }

  if (game.summary) {
    const summary = document.createElement("p");
    summary.className = "card__summary";
    summary.textContent = game.summary;
    summary.title = game.summary;
    more.append(summary);
  }

  const actions = document.createElement("div");
  actions.className = "card__actions";
  for (const { key, label, short } of LINK_BUTTONS) actions.append(linkButton(label, game.links[key], short));
  more.append(actions);
  return more;
}

const SOURCE_LABEL: Record<ScoreSource, string> = {
  opencritic: "OpenCritic",
  metacritic: "Metacritic",
  metacriticUser: "Metacritic users",
  backloggd: "Backloggd",
};

/** Tiny trend line under a ring (normalized 0–100 values), only with at least two different values. */
function sparkline(source: ScoreSource, series: { date: string; normalized: number }[]) {
  const W = 46;
  const H = 14;
  const values = series.map((p) => p.normalized);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const pts = series.map((p, i) => [
    2 + (i / (series.length - 1)) * (W - 4),
    H - 2 - ((p.normalized - min) / span) * (H - 4),
  ]);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "ring__spark");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("width", String(W));
  svg.setAttribute("height", String(H));
  svg.setAttribute("role", "img");
  const first = series[0];
  const last = series.at(-1)!;
  const label = `${SOURCE_LABEL[source]} trend: ${first.normalized} on ${first.date}, ${last.normalized} on ${last.date}`;
  svg.setAttribute("aria-label", label);
  svg.innerHTML = `<title>${label}</title><polyline points="${pts.map((p) => p.map((n) => n.toFixed(1)).join(",")).join(" ")}"/><circle cx="${pts.at(-1)![0].toFixed(1)}" cy="${pts.at(-1)![1].toFixed(1)}" r="1.8"/>`;
  return svg;
}

function addSparklines(card: HTMLElement, game: Game) {
  for (const ring of card.querySelectorAll<HTMLElement>(".ring[data-source]")) {
    const source = ring.dataset.source as ScoreSource;
    const series = game.scoreHistory?.[source];
    if (series && new Set(series.map((p) => p.normalized)).size > 1) ring.append(sparkline(source, series));
  }
}

export type Anchor = "above" | "below" | "center";

const ORIGIN: Record<Anchor, string> = { above: "50% 100%", below: "50% 0%", center: "50% 50%" };

/**
 * Grows the card (×1.05) and unfolds the extra content. `bounds` is the visible band
 * (client coordinates): if the expanded card spills out of it, it is nudged back in.
 */
export function expandCard(card: HTMLElement, game: Game, todayDay: number, anchor: Anchor, bounds: () => DOMRect) {
  collapseCard(card, true);
  const more = buildMore(card, game, todayDay);
  card.append(more);
  addSparklines(card, game);
  // One band for upcoming games: "UPCOMING · Out in 26 days".
  const upcomingWhen = card.querySelector<HTMLElement>(".card__upcoming-when");
  if (upcomingWhen) {
    upcomingWhen.dataset.short ??= upcomingWhen.textContent ?? "";
    upcomingWhen.textContent = relativeRelease(game, todayDay);
  }
  card.classList.add("is-selected");
  const fit = () => {
    const r = card.getBoundingClientRect();
    const b = bounds();
    // Taller than the room on its side of the line: shrink it, its edge toward the line
    // staying put, rather than push it over the line (where it would look cut off).
    const room = anchor === "above" ? r.bottom - b.top : anchor === "below" ? b.bottom - r.top : b.height;
    if (anchor !== "center" && r.height > room) {
      const scale = Number(gsap.getProperty(card, "scale")) * (room / r.height);
      gsap.to(card, { scale, duration: reducedMotion.matches ? 0 : 0.2, ease: "power2.out", overwrite: "auto" });
      return;
    }
    const dy = r.top < b.top ? b.top - r.top : r.bottom > b.bottom ? b.bottom - r.bottom : 0;
    if (!dy) return;
    // `y` is in the card's parent coordinates, which shrink with the window (--card-scale):
    // convert the on-screen correction back to them.
    const parentScale = r.height / (card.offsetHeight * Number(gsap.getProperty(card, "scaleY")));
    gsap.to(card, { y: `+=${dy / parentScale}`, duration: reducedMotion.matches ? 0 : 0.25, ease: "power2.out", overwrite: "auto" });
  };
  if (reducedMotion.matches) {
    gsap.set(card, { scale: 1.05, y: 0, opacity: 1, transformOrigin: ORIGIN[anchor], overwrite: "auto" });
    fit();
    return;
  }
  gsap.to(card, { scale: 1.05, y: 0, opacity: 1, transformOrigin: ORIGIN[anchor], duration: 0.3, ease: "power2.out", overwrite: "auto" });
  gsap.from(more, { height: 0, opacity: 0, duration: 0.35, ease: "power2.out", clearProps: "height", onComplete: fit });
}

/** Back to the normal card; `instant` when switching straight to another state. */
export function collapseCard(card: HTMLElement, instant = false) {
  card.classList.remove("is-selected");
  card.querySelectorAll(".ring__spark").forEach((s) => s.remove());
  const upcomingWhen = card.querySelector<HTMLElement>(".card__upcoming-when");
  if (upcomingWhen?.dataset.short !== undefined) upcomingWhen.textContent = upcomingWhen.dataset.short;
  const more = card.querySelector<HTMLElement>(".card__more");
  const duration = instant || reducedMotion.matches ? 0 : 0.25;
  gsap.to(card, { scale: 1, y: 0, duration, ease: "power2.out", overwrite: "auto" });
  if (!more) return;
  if (!duration) return more.remove();
  gsap.to(more, { height: 0, opacity: 0, duration, ease: "power2.in", onComplete: () => more.remove() });
}
