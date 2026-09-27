import { gsap } from "gsap";
import { type Card, cardWidth, createCard } from "../cards/card";
import type { Side } from "../cards/layout";
import type { Game } from "../types";
import { MONTHS } from "./dates";

/**
 * Same-day releases (ITERATION-4 §4): from this many games on one day (after the
 * filters), the timeline shows one group instead of a pile of cards.
 */
export const GROUP_MIN_GAMES = 3;
/** Width of the closed group, for the lane layout. */
export const GROUP_WIDTH = 220;

/** The open fan is at most this wide (and never wider than the view): cards overlap more when there are many. */
const FAN_MAX_SPAN = 1400;
/** Degrees between neighbouring cards of the open fan. */
const FAN_SPREAD = 3.5;
/** How much higher (px) the middle of the fan sits than its ends. */
const FAN_ARC = 26;
const OPEN_S = 0.45;
const CLOSE_S = 0.3;

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

function longDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** Closed group: covers overlapping like a closed fan, "N games" and the date. */
export function createGroupStack(games: Game[]): Card {
  const el = document.createElement("article");
  el.className = "card card--group";
  el.style.setProperty("--w-full", `${GROUP_WIDTH}px`);
  el.style.setProperty("--w-compact", `${GROUP_WIDTH}px`);
  // A click (or Enter) on the group selects its first game, which opens it.
  el.dataset.gameId = games[0].id;
  el.tabIndex = -1;
  const date = games[0].firstReleaseDate!;
  el.setAttribute("aria-label", `${games.length} games released on ${longDate(date)}: ${games.map((g) => g.title).join(", ")}. Press Enter to open.`);

  const covers = document.createElement("div");
  covers.className = "group-stack__covers";
  const shown = games.slice(0, 5);
  shown.forEach((g, i) => {
    const img = document.createElement("img");
    img.className = "group-stack__cover";
    img.src = g.coverUrl;
    img.alt = "";
    img.draggable = false;
    img.loading = "lazy";
    const mid = (shown.length - 1) / 2;
    img.style.setProperty("--i", String(i - mid));
    img.style.zIndex = String(shown.length - Math.abs(Math.round(i - mid)));
    covers.append(img);
  });

  const label = document.createElement("div");
  label.className = "group-stack__label";
  const count = document.createElement("strong");
  count.textContent = `${games.length} games`;
  const when = document.createElement("span");
  when.textContent = longDate(date);
  label.append(count, when);
  el.append(covers, label);
  return { el, rings: [] };
}

/**
 * The open group: the games' cards spread in a fan around the date, on the group's side
 * of the line, overlapping; the selected one stands straight, on top.
 */
export class Fan {
  cards: Card[] = [];
  isOpen = false;

  constructor(
    private readonly host: HTMLElement,
    private readonly stack: Card,
    readonly games: Game[],
    private readonly todayDay: number,
    /** Side and stacking offset of the group's lane, read when opening. */
    private readonly lane: () => { side: Side; extra: number },
    private readonly compact: () => boolean,
    /** Room in the view (unscaled px), so the whole fan stays on screen. */
    private readonly room: () => number,
  ) {}

  /** The card of a game of the group (all cards are created on first use). */
  cardOf(gameId: string) {
    this.ensure();
    return this.cards[this.games.findIndex((g) => g.id === gameId)].el;
  }

  private ensure() {
    if (this.cards.length) return;
    this.cards = this.games.map((game) => {
      const card = createCard(game, this.todayDay);
      card.el.classList.add("fan-card");
      card.el.hidden = true;
      card.rings.forEach((r) => r.finish());
      this.host.append(card.el);
      return card;
    });
  }

  /** Where card i sits in the open fan, relative to the date. */
  private poseOf(i: number) {
    const n = this.games.length;
    const w = cardWidth(this.games[i], this.compact());
    const maxSpan = Math.max(w * 1.5, Math.min(FAN_MAX_SPAN, this.room()));
    const step = Math.min(w * 0.5, (maxSpan - w) / Math.max(1, n - 1));
    const span = w + step * (n - 1);
    const mid = (n - 1) / 2;
    const { side, extra } = this.lane();
    const dir = side === "above" ? 1 : -1;
    const off = i - mid;
    return {
      left: -span / 2 + i * step,
      lift: extra + FAN_ARC * (1 - (off / Math.max(1, mid)) ** 2),
      rotation: dir * off * FAN_SPREAD,
      side,
    };
  }

  /** Card positions for the current side and width (also after the card style changes). */
  layout(selectedId: string | null = null, instant = false) {
    if (!this.cards.length) return;
    this.cards.forEach((card, i) => {
      const pose = this.poseOf(i);
      const el = card.el;
      el.style.left = `${pose.left}px`;
      el.style[pose.side === "above" ? "bottom" : "top"] = `${pose.lift}px`;
      el.style[pose.side === "above" ? "top" : "bottom"] = "";
      el.style.transformOrigin = pose.side === "above" ? "50% 100%" : "50% 0%";
      const selected = this.games[i].id === selectedId;
      el.style.zIndex = String(selected ? 100 : i + 1);
      const rotation = selected ? 0 : pose.rotation;
      if (instant || reducedMotion.matches) gsap.set(el, { rotation });
      else gsap.to(el, { rotation, duration: 0.3, ease: "power2.out", overwrite: false });
    });
  }

  /** Spreads the cards out of the closed stack. */
  open(selectedId: string, animate: boolean) {
    if (this.isOpen) return this.layout(selectedId);
    this.isOpen = true;
    this.ensure();
    this.host.closest(".tl-item")?.classList.add("is-fanned");
    for (const card of this.cards) card.el.hidden = false;
    this.layout(selectedId, true);
    const stackMid = this.stack.el.offsetLeft + this.stack.el.offsetWidth / 2;
    if (!animate || reducedMotion.matches) {
      gsap.set(this.stack.el, { autoAlpha: 0 });
      return;
    }
    gsap.to(this.stack.el, { autoAlpha: 0, scale: 0.9, duration: OPEN_S * 0.6, ease: "power2.in" });
    this.cards.forEach((card, i) => {
      const el = card.el;
      gsap.from(el, {
        x: stackMid - (el.offsetLeft + el.offsetWidth / 2),
        rotation: 0,
        scale: 0.6,
        opacity: 0,
        duration: OPEN_S,
        delay: i * 0.025,
        ease: "back.out(1.2)",
        immediateRender: true,
      });
    });
  }

  /** Folds the cards back into the stack. */
  close(animate: boolean) {
    if (!this.isOpen) return;
    this.isOpen = false;
    const item = this.host.closest(".tl-item");
    const stackMid = this.stack.el.offsetLeft + this.stack.el.offsetWidth / 2;
    const done = () => {
      if (this.isOpen) return;
      for (const card of this.cards) {
        card.el.hidden = true;
        gsap.set(card.el, { clearProps: "x,scale,opacity" });
      }
      item?.classList.remove("is-fanned");
    };
    if (!animate || reducedMotion.matches) {
      gsap.set(this.stack.el, { autoAlpha: 1, scale: 1 });
      return done();
    }
    gsap.to(this.stack.el, { autoAlpha: 1, scale: 1, duration: CLOSE_S, delay: CLOSE_S * 0.4, ease: "power2.out" });
    this.cards.forEach((card) => {
      const el = card.el;
      gsap.to(el, {
        x: stackMid - (el.offsetLeft + el.offsetWidth / 2),
        rotation: 0,
        scale: 0.6,
        opacity: 0,
        duration: CLOSE_S,
        ease: "power2.in",
        overwrite: true,
      });
    });
    gsap.delayedCall(CLOSE_S + 0.02, done);
  }
}
