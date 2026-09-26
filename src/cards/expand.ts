import { gsap } from "gsap";
import { parseDay } from "../timeline/dates";
import type { Game } from "../types";

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

/** Reference links shown as buttons in the selected card; more can be appended (e.g. Nintendo Store). */
const LINK_BUTTONS: { key: keyof Game["links"]; label: string }[] = [
  { key: "wikipedia", label: "Wikipedia" },
  { key: "nintendoWiki", label: "Nintendo Wiki" },
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

function linkButton(label: string, href: string | undefined) {
  if (!href) {
    const off = document.createElement("span");
    off.className = "card-button is-disabled";
    off.setAttribute("aria-disabled", "true");
    off.title = `No ${label} page`;
    off.textContent = label;
    return off;
  }
  const a = document.createElement("a");
  a.className = "card-button";
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = label;
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
  for (const { key, label } of LINK_BUTTONS) actions.append(linkButton(label, game.links[key]));
  more.append(actions);
  return more;
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
  const upcomingWhen = card.querySelector<HTMLElement>(".card__upcoming-when");
  if (upcomingWhen?.dataset.short !== undefined) upcomingWhen.textContent = upcomingWhen.dataset.short;
  const more = card.querySelector<HTMLElement>(".card__more");
  const duration = instant || reducedMotion.matches ? 0 : 0.25;
  gsap.to(card, { scale: 1, y: 0, duration, ease: "power2.out", overwrite: "auto" });
  if (!more) return;
  if (!duration) return more.remove();
  gsap.to(more, { height: 0, opacity: 0, duration, ease: "power2.in", onComplete: () => more.remove() });
}
