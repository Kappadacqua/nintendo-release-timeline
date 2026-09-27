import { gsap } from "gsap";
import { type Card, CARD_WIDTH, cardWidth, createCard } from "../cards/card";
import type { Side } from "../cards/layout";
import type { Game } from "../types";
import { MONTHS } from "./dates";

/**
 * Same-day releases (ITERATION-4 §4): from this many games on one day (after the
 * filters), the timeline shows one group instead of a pile of cards.
 */
export const GROUP_MIN_GAMES = 3;
/** Width of the closed group, for the lane layout (zoomed out: covers only). */
export const GROUP_WIDTH = 220;
export const GROUP_COVER_WIDTH = 96;

/** Gap (px) between the cards of the open fan: they never overlap, so every title reads. */
const FAN_GAP = 16;
/** Degrees each step away from the selected card tilts (at most FAN_MAX_TILT). */
const FAN_TILT = 1.5;
const FAN_MAX_TILT = 5;
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
  el.style.setProperty("--w-cover", `${GROUP_COVER_WIDTH}px`);
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

  /**
   * Where each card sits in the open fan, relative to the date: the selected card (full
   * size) right under the playhead, the others (compact: cover, title) in order on both
   * sides, side by side. The row slides as the selection moves; cards past the edges of
   * the view come in with Page Up / Page Down.
   */
  private poses(selected: number) {
    const { side, extra } = this.lane();
    const dir = side === "above" ? 1 : -1;
    const width = (i: number) => (i === selected ? CARD_WIDTH[this.games[i].kind === "dlc" ? "dlc" : "game"] : cardWidth(this.games[i], true));
    const lefts: number[] = [];
    lefts[selected] = -width(selected) / 2;
    for (let i = selected - 1; i >= 0; i--) lefts[i] = lefts[i + 1] - FAN_GAP - width(i);
    for (let i = selected + 1; i < this.games.length; i++) lefts[i] = lefts[i - 1] + width(i - 1) + FAN_GAP;
    // The selected card grows ×1.05 around its center: keep the neighbours clear of it.
    const grow = (width(selected) * 0.05) / 2;
    return this.games.map((_, i) => {
      const off = i - selected;
      return {
        left: lefts[i] + Math.sign(off) * grow,
        lift: extra,
        rotation: dir * Math.sign(off) * Math.min(FAN_MAX_TILT, Math.abs(off) * FAN_TILT),
        side,
      };
    });
  }

  /** Card positions around the selected game; they glide there unless `instant`. */
  layout(selectedId: string | null = null, instant = false) {
    if (!this.cards.length) return;
    const selected = Math.max(0, this.games.findIndex((g) => g.id === selectedId));
    const poses = this.poses(selected);
    const quick = instant || reducedMotion.matches;
    this.cards.forEach((card, i) => {
      const pose = poses[i];
      const el = card.el;
      el.style[pose.side === "above" ? "bottom" : "top"] = `${pose.lift}px`;
      el.style[pose.side === "above" ? "top" : "bottom"] = "";
      el.style.transformOrigin = pose.side === "above" ? "50% 100%" : "50% 0%";
      el.style.zIndex = String(i === selected ? 100 : 50 - Math.abs(i - selected));
      const to = { left: pose.left, rotation: i === selected ? 0 : pose.rotation };
      if (quick) gsap.set(el, to);
      else gsap.to(el, { ...to, duration: 0.3, ease: "power2.out", overwrite: false });
    });
  }

  /** Spreads the cards out of the closed stack. */
  open(selectedId: string, animate: boolean) {
    if (this.isOpen) return this.layout(selectedId);
    this.isOpen = true;
    this.ensure();
    this.host.closest(".tl-item")?.classList.add("is-fanned");
    // A close still running (reopened quickly) must not bring the stack back afterwards.
    gsap.killTweensOf([this.stack.el, ...this.cards.map((c) => c.el)]);
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
    gsap.killTweensOf(this.stack.el);
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
