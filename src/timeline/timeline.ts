import { gsap } from "gsap";
import { hideCard, revealCard } from "../cards/appear";
import { MORPH_SECONDS, morphParts } from "../cards/compact";
import { type Anchor, collapseCard, expandCard } from "../cards/expand";
import { type Card, cardWidth, createCard } from "../cards/card";
import { assignLanes, type Lane } from "../cards/layout";
import { currentDelay } from "../history";
import { news } from "../news";
import type { Game } from "../types";
import { TIMELINE } from "./config";
import { dayToDate, MONTHS, parseDay, todayEpochDay, WEEKDAYS } from "./dates";
import { TimelineHeader } from "./header";
import { Minimap } from "./minimap";
import { bindScrollInput, Scroller } from "./scroller";
import { Backdrop } from "./backdrop";
import { SiteTitle } from "./site-title";
import { createTbaBlockNode, layoutTba, TBA_LAYOUT, type TbaBlock } from "./tba";

interface Item {
  game: Game;
  x: number;
  width: number;
  lane: Lane;
  /** Created lazily the first time the item comes near the viewport. */
  node?: {
    root: HTMLElement;
    group: HTMLElement;
    connectors: SVGSVGElement[];
    card: Card;
    stubPath: SVGPathElement;
    /** Connector from the band edge out to a stacked card (hidden at level 0). */
    restPath: SVGPathElement;
    targetX: number;
    dir: number;
  };
  inRange: boolean;
  revealed: boolean;
}

function svgPath(className: string) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(ns, "path");
  svg.append(path);
  return { svg, path };
}

/** A game the keyboard can land on: dated card or TBA card, in timeline order. */
interface Stop {
  x: number;
  game: Game;
  /** Which way the card grows when selected (toward the line for dated cards). */
  anchor: Anchor;
  /** Creates the card on demand and returns it. */
  card: () => HTMLElement;
  /** Makes sure the entrance animation has run (a selected card must be visible). */
  reveal: () => void;
  /** Element to lift above the others while selected. */
  layer: () => HTMLElement;
}

interface Palette {
  line: string;
  monthBand: string;
  tick: string;
  label: string;
  accent: string;
  onAccent: string;
  font: string;
}

/**
 * Horizontal timeline. World coordinates: x = (days since start) * dayPx.
 * Ticks and the line are drawn on a canvas sized to the viewport, so only the
 * visible range is ever drawn; DOM markers live in a translated "world" layer.
 */
export class Timeline {
  private readonly el: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly world: HTMLElement;
  private readonly header = new TimelineHeader();
  private readonly scroller: Scroller;
  private readonly items: Item[];
  /** Compact cards (ITERATION-4 §2): layout and fitting use their size. */
  private compact: boolean;
  private readonly tbaBlocks: TbaBlock[];
  private readonly minimap: Minimap;

  private readonly startDay = parseDay(TIMELINE.startDate);
  private readonly todayDay = todayEpochDay();
  private readonly endDay: number;
  /** World x where the TBA zone starts and ends (equal when there are no TBA games). */
  private readonly tbaStartX: number;
  private readonly worldEnd: number;

  private width = 0;
  private height = 0;
  private lineY = 0;
  private palette!: Palette;
  private lastCenter = 0;
  private ready = false;
  private stops: Stop[];
  /** Index in `stops` of the tabbable card (the one nearest the center). */
  private current = -1;
  /** True while focus is moved by the timeline itself, which must not re-center the view. */
  private movingFocus = false;
  private cardScale = 1;
  /** True only for the first render: cards on screen at page open appear without an entrance. */
  private opening = false;
  private readonly band: HTMLElement;

  /** Index in `stops` of the selected card, or -1. */
  private selected = -1;
  private readonly siteTitle: SiteTitle | null;
  private readonly backdrop = new Backdrop();
  /** Cleanups for everything registered outside this.el (window, document, observers). */
  private readonly disposers: (() => void)[] = [];
  private destroyed = false;

  constructor(
    root: HTMLElement,
    games: Game[],
    headerSlot?: HTMLElement,
    titleEl?: HTMLElement,
    options: { compact?: boolean } = {},
  ) {
    this.compact = options.compact ?? false;
    const lastRelease = games
      .flatMap((g) => Object.values(g.releaseDates))
      .filter((d): d is string => !!d)
      .reduce((max, d) => Math.max(max, parseDay(d)), this.startDay);
    this.endDay = Math.max(lastRelease, this.todayDay) + TIMELINE.endMarginDays;

    this.el = document.createElement("div");
    this.el.className = `timeline${this.compact ? " is-compact" : ""}`;
    this.el.setAttribute("role", "region");
    this.el.setAttribute("aria-label", "Release timeline. Press ? for keyboard shortcuts.");

    this.canvas = document.createElement("canvas");
    this.canvas.className = "timeline__canvas";
    this.canvas.setAttribute("aria-hidden", "true");
    this.ctx = this.canvas.getContext("2d")!;

    this.world = document.createElement("div");
    this.world.className = "timeline__world";
    this.world.append(this.todayMarker());
    this.items = this.layoutItems(games);
    this.world.append(...this.delayGhosts(games));

    const tba = layoutTba(
      games.filter((g) => !g.firstReleaseDate),
      this.dayX(this.endDay) + TIMELINE.tbaGapPx,
    );
    this.tbaBlocks = tba.blocks;
    this.tbaStartX = this.tbaBlocks.length ? this.tbaBlocks[0].x : this.dayX(this.endDay);
    this.worldEnd = Math.max(tba.endX, this.dayX(this.endDay));

    this.stops = this.buildStops();

    this.minimap = this.createMinimap();
    // Fixed playhead at the center; the timeline scrolls under it (cards stay above it).
    const playhead = document.createElement("div");
    playhead.className = "timeline__playhead";
    playhead.setAttribute("aria-hidden", "true");
    playhead.style.bottom = `${TIMELINE.minimapBandPx}px`;
    // Translucent band behind the line and its labels, shown over a game background.
    this.band = document.createElement("div");
    this.band.className = "timeline__band";
    this.band.setAttribute("aria-hidden", "true");
    this.el.append(this.band, this.canvas, playhead, this.world, this.minimap.el);
    (headerSlot ?? this.el).append(this.header.el);
    root.append(this.el);
    this.el.addEventListener("focusin", (e) => this.onFocusIn(e));
    this.el.addEventListener("click", (e) => this.onClick(e));
    this.el.addEventListener("keydown", (e) => this.onCardKey(e));
    this.siteTitle = titleEl ? new SiteTitle(titleEl) : null;

    this.scroller = new Scroller((x) => this.render(x));
    this.scroller.snap = (x) => this.snapToDay(x);
    const unbindKeys = bindScrollInput(this.el, this.scroller, {
      dayPx: TIMELINE.dayPx,
      onDayStep: (days) => {
        this.deselect();
        this.scroller.scrollTo(this.snapToDay(this.scroller.target) + days * TIMELINE.dayPx);
      },
      onToday: () => {
        this.deselect();
        this.scroller.scrollTo(this.dayX(this.todayDay));
      },
      onHome: () => {
        this.deselect();
        this.scroller.scrollTo(0);
      },
      onEnd: () => {
        this.deselect();
        this.scroller.scrollTo(this.worldEnd);
      },
      onEscape: () => this.deselect(),
      onDragStart: () => this.deselect(),
      onGameStep: (direction) => this.stepGame(direction),
      onKeyNavigate: () => this.followWithFocus(),
    });

    this.readPalette();
    this.watchTheme();
    this.disposers.push(unbindKeys, () => this.scroller.dispose());
    const resizeObserver = new ResizeObserver(() => this.resize());
    resizeObserver.observe(this.el);
    this.disposers.push(() => resizeObserver.disconnect());
    this.resize();
    this.scroller.jumpTo(this.dayX(this.todayDay));
    this.ready = true;
    this.opening = true;
    this.render(this.scroller.current);
    this.opening = false;
    // Month labels use the web font; redraw once it has loaded.
    document.fonts.ready.then(() => this.render(this.scroller.current));
  }

  /** Center the next / previous game (dated or TBA) relative to where the scroll is heading. */
  /**
   * PagGiù / PagSu: the game after / before the selected one or, with nothing
   * selected, the first game strictly after (before) the playhead.
   */
  private stepGame(direction: 1 | -1) {
    let next: number;
    if (this.selected >= 0) {
      next = this.selected + direction;
    } else {
      const at = this.scroller.target;
      next = direction > 0 ? this.stops.findIndex((s) => s.x > at + 0.5) : this.stops.findLastIndex((s) => s.x < at - 0.5);
    }
    if (next >= 0 && next < this.stops.length) this.select(next);
  }

  /** Removes the timeline and every listener it registered (it is rebuilt when filters change). */
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const dispose of this.disposers) dispose();
    this.backdrop.destroy();
    this.siteTitle?.destroy();
    this.header.el.remove();
    this.el.remove();
  }

  /** Where the view is and what is selected, to come back to it after a reload. */
  getState() {
    return { x: this.scroller.target, selectedId: this.selected >= 0 ? this.stops[this.selected].game.id : null };
  }

  restoreState(state: { x: number; selectedId: string | null }) {
    // Like the first paint: header and cards are simply there (no animation to wait for,
    // which also holds in a background tab, where animations are paused).
    this.opening = true;
    this.scroller.jumpTo(state.x);
    this.opening = false;
    if (state.selectedId) this.selectById(state.selectedId);
  }

  /** Selects a game by id, e.g. from search (ITERATION-3); returns false if it isn't on the timeline. */
  selectById(gameId: string) {
    const index = this.stops.findIndex((s) => s.game.id === gameId);
    if (index >= 0) this.select(index);
    return index >= 0;
  }

  private select(index: number) {
    if (index === this.selected) return;
    const stop = this.stops[index];
    if (this.selected >= 0) this.unmark(this.selected);
    this.selected = index;
    this.setCurrent(index);
    stop.reveal();
    const card = stop.card();
    card.closest<HTMLElement>("[hidden]")?.removeAttribute("hidden");
    stop.layer().classList.add("is-selected-layer");
    this.el.classList.add("has-selection");
    // A compact card unfolds into the full one.
    morphParts([card], () => expandCard(card, stop.game, this.todayDay, stop.anchor, () => this.visibleBand()), !this.opening);
    this.siteTitle?.show(stop.game);
    this.backdrop.show(stop.game);
    news.markSeen(stop.game.id);
    // Neighbours' images ready before PagSu / PagGiù.
    for (const n of [index - 1, index + 1]) this.backdrop.preload(this.stops[n]?.game.backgroundUrl);
    this.scroller.scrollTo(stop.x);
  }

  /** Esc, scrolling, clicks on empty space…: back to plain browsing. */
  private deselect() {
    if (this.selected < 0) return;
    this.unmark(this.selected);
    this.selected = -1;
    this.el.classList.remove("has-selection");
    this.siteTitle?.clear();
    this.backdrop.hide();
  }

  private unmark(index: number) {
    const stop = this.stops[index];
    const card = stop.card();
    morphParts([card], () => collapseCard(card));
    stop.layer().classList.remove("is-selected-layer");
  }

  /** Where a selected card must fit: between the top of the timeline and the minimap. */
  private visibleBand() {
    const r = this.el.getBoundingClientRect();
    return new DOMRect(r.left, r.top + 8, r.width, r.height - TIMELINE.minimapBandPx - 16);
  }

  private stopOfCard(card: Element) {
    const id = (card as HTMLElement).dataset.gameId;
    return this.stops.findIndex((s) => s.game.id === id);
  }

  /** Click on a card selects it (never follows a link until it is selected); elsewhere deselects. */
  private onClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest(".minimap")) return;
    const card = target.closest(".card");
    if (!card) return this.deselect();
    const index = this.stopOfCard(card);
    if (index < 0 || index === this.selected) return;
    e.preventDefault();
    this.select(index);
  }

  /** Enter / Space on a focused card selects it. */
  private onCardKey(e: KeyboardEvent) {
    if (e.key !== "Enter" && e.key !== " ") return;
    const target = e.target as HTMLElement;
    if (!target.classList.contains("card")) return;
    const index = this.stopOfCard(target);
    if (index < 0) return;
    e.preventDefault();
    this.select(index);
  }


  private buildStops(): Stop[] {
    const dated: Stop[] = this.items.map((item) => {
      const node = () => (item.node ??= this.createNode(item));
      return {
        x: item.x,
        game: item.game,
        anchor: item.lane.side,
        card: () => node().card.el,
        layer: () => node().root,
        reveal: () => {
          if (item.revealed) return;
          item.revealed = true;
          revealCard(node().connectors, node().card, item.lane.side);
        },
      };
    });
    const tba: Stop[] = this.tbaBlocks.flatMap((block) =>
      block.slots.map((slot) => {
        const card = () => {
          if (!block.node) this.createTbaNode(block);
          return slot.card!;
        };
        return {
          x: slot.x,
          game: slot.game,
          anchor: "center" as const,
          card: () => card().el,
          layer: () => card().el,
          reveal: () => {
            if (slot.revealed) return;
            slot.revealed = true;
            revealCard(null, card(), "above");
          },
        };
      }),
    );
    // By first release date, then title; the TBA zone comes last, by year (its x order).
    return [...dated, ...tba].sort((a, b) => a.x - b.x || a.game.title.localeCompare(b.game.title));
  }


  private nearestStop(x: number) {
    let best = -1;
    let bestD = Infinity;
    this.stops.forEach((s, i) => {
      const d = Math.abs(s.x - x);
      if (d < bestD) [best, bestD] = [i, d];
    });
    return best;
  }

  /** Roving tabindex: only the centered game's card and links are in the Tab order. */
  private setCurrent(index: number) {
    if (index === this.current || index < 0) return;
    const setTabbable = (card: HTMLElement, on: boolean) => {
      card.tabIndex = on ? 0 : -1;
      card.querySelectorAll("a").forEach((a) => (a.tabIndex = on ? 0 : -1));
    };
    if (this.current >= 0) setTabbable(this.stops[this.current].card(), false);
    this.current = index;
    setTabbable(this.stops[index].card(), true);
  }

  private isCurrentCard(el: HTMLElement) {
    return this.current >= 0 && this.stops[this.current].card() === el;
  }

  /** Keyboard focus on a card (Tab, screen reader) brings it to the center. */
  private onFocusIn(e: FocusEvent) {
    if (this.movingFocus) return;
    const card = (e.target as HTMLElement).closest<HTMLElement>(".card");
    if (!card || !card.matches(":focus-visible, :has(:focus-visible)")) return;
    const index = this.stopOfCard(card);
    if (index < 0) return;
    this.setCurrent(index);
    if (Math.abs(this.scroller.target - this.stops[index].x) > 1) this.scroller.scrollTo(this.stops[index].x);
  }

  /** After keyboard navigation, focus follows the game nearest to where the view is heading. */
  private followWithFocus() {
    if (!this.el.contains(document.activeElement)) return;
    const index = this.selected >= 0 ? this.selected : this.nearestStop(this.scroller.target);
    if (index < 0) return;
    this.setCurrent(index);
    const card = this.stops[index].card();
    // Culled cards sit in a [hidden] container until the next frame; unhide now so focus() works.
    card.closest<HTMLElement>("[hidden]")?.removeAttribute("hidden");
    if (card.contains(document.activeElement)) return;
    // The view is already heading where the key sent it (e.g. today): keep that target.
    this.movingFocus = true;
    card.focus({ preventScroll: true });
    this.movingFocus = false;
  }

  /** Scales cards down so they fit between the top bar and the minimap on short windows. */
  private fitCards() {
    const maxLevel = Math.max(0, ...this.items.map((i) => i.lane.level));
    // The label band (cardOffset) never shrinks; only cards and stacking do.
    const room = Math.min(this.lineY, this.height - TIMELINE.minimapBandPx - this.lineY) - TIMELINE.cardOffset - 12;
    const need = (this.compact ? TIMELINE.compactCardMaxHeight : TIMELINE.cardMaxHeight) + maxLevel * TIMELINE.stackStepY;
    this.cardScale = Math.max(TIMELINE.minCardScale, Math.min(1, room / need));
    this.el.style.setProperty("--card-scale", this.cardScale.toFixed(3));
    for (const item of this.items) if (item.node) this.drawStub(item.node);
  }

  private dayX(day: number) {
    return (day - this.startDay) * TIMELINE.dayPx;
  }

  /**
   * Delayed games (ITERATION-3 §3): a dashed "ghost" on the original date, joined
   * to the new date by a dashed arc (just the ghost if the game went back to TBA).
   */
  private delayGhosts(games: Game[]) {
    const today = dayToDate(this.todayDay).toISOString().slice(0, 10);
    const long = (iso: string) => {
      const d = dayToDate(parseDay(iso));
      return `${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
    };
    return games.flatMap((game) => {
      const delay = currentDelay(game, today);
      if (!delay) return [];
      const from = this.dayX(parseDay(delay.from));
      const ghost = document.createElement("div");
      ghost.className = "tl-ghost";
      ghost.style.left = `${from}px`;
      ghost.title = `${game.title}: originally ${long(delay.from)}, now ${game.firstReleaseDate ? long(game.firstReleaseDate) : (game.vagueRelease?.label ?? "TBA")}`;
      if (!game.firstReleaseDate) return [ghost];
      const to = this.dayX(parseDay(game.firstReleaseDate));
      const width = Math.max(1, to - from);
      const rise = Math.min(46, 14 + width / 40);
      const arc = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      arc.setAttribute("class", "tl-ghost__arc");
      arc.setAttribute("aria-hidden", "true");
      arc.style.left = `${from}px`;
      arc.style.top = `${-rise}px`;
      arc.setAttribute("width", String(width));
      arc.setAttribute("height", String(rise));
      arc.setAttribute("viewBox", `0 0 ${width} ${rise}`);
      arc.innerHTML = `<path d="M0 ${rise} Q ${width / 2} ${-rise * 0.9} ${width} ${rise}"/>`;
      return [arc, ghost];
    });
  }

  private todayMarker() {
    const marker = document.createElement("div");
    marker.className = "timeline-today";
    marker.style.left = `${this.dayX(this.todayDay)}px`;
    marker.innerHTML = `<span class="timeline-today__label">Today</span><span class="timeline-today__dot"></span>`;
    return marker;
  }

  /** Games with a precise date, positioned and assigned to lanes. */
  private layoutItems(games: Game[]): Item[] {
    const placed = games
      .filter((game) => game.firstReleaseDate)
      .map((game) => ({ game, x: this.dayX(parseDay(game.firstReleaseDate!)), width: cardWidth(game, this.compact) }))
      .sort((a, b) => a.x - b.x);
    const lanes = assignLanes(placed, TIMELINE.laneGap, TIMELINE.maxShift);
    return placed.map((p, i) => ({ ...p, lane: lanes[i], inRange: false, revealed: false }));
  }

  /**
   * Card node: a fixed-length stub from the line to the edge of the label band
   * (day numbers, months), then a group that scales on short windows with the
   * card and, for stacked cards, the rest of the connector.
   */
  private createNode(item: Item) {
    const root = document.createElement("div");
    root.style.left = `${item.x}px`;
    const stub = svgPath("tl-item__connector");
    const rest = svgPath("tl-item__connector");
    const group = document.createElement("div");
    group.className = "tl-item__group";
    const dot = document.createElement("div");
    // Color by type, filled once released (ITERATION-4 §3).
    const upcoming = parseDay(item.game.firstReleaseDate!) > this.todayDay;
    dot.className = `tl-item__dot tl-item__dot--${item.game.kind}${upcoming ? " is-upcoming" : ""}`;
    const card = createCard(item.game, this.todayDay);
    group.append(rest.svg, card.el);
    root.append(stub.svg, dot, group);
    this.world.append(root);
    const connectors = [stub.svg, rest.svg];
    const node = { root, group, connectors, card, stubPath: stub.path, restPath: rest.path, targetX: 0, dir: 1 };
    item.node = node;
    this.placeNode(item);
    hideCard(connectors, card);
    return node;
  }

  /** Puts card and connectors where the item's lane says (also after the card style changes). */
  private placeNode(item: Item) {
    const node = item.node!;
    const { side, level, shift } = item.lane;
    const dir = side === "above" ? -1 : 1;
    node.root.classList.add("tl-item");
    node.root.classList.toggle("tl-item--above", side === "above");
    node.root.classList.toggle("tl-item--below", side === "below");
    node.root.style.zIndex = String(10 - level);

    const cardLeft = -item.width / 2 + shift + level * TIMELINE.stackStepX;
    // Straight connector when the card still sits over its date, elbow otherwise.
    const inset = 24;
    node.targetX = cardLeft + inset <= 0 && 0 <= cardLeft + item.width - inset ? 0 : cardLeft + inset;
    node.dir = dir;
    node.group.style.top = `${dir * TIMELINE.cardOffset}px`;

    const extra = level * TIMELINE.stackStepY;
    node.restPath.setAttribute("d", extra > 0 ? `M${node.targetX} 0 V${dir * extra}` : "");

    const el = node.card.el;
    el.style.left = `${cardLeft}px`;
    el.style[side === "above" ? "bottom" : "top"] = `${extra}px`;
    el.style[side === "above" ? "top" : "bottom"] = "";
    this.drawStub(node);
  }

  /**
   * Full / compact cards (ITERATION-4 §2), animated: lanes are recomputed with the new
   * widths, cards glide to their new place while resizing and their parts fold / unfold.
   */
  setCompact(compact: boolean) {
    if (compact === this.compact) return;
    this.compact = compact;
    const animate = this.ready && !matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lanes = assignLanes(
      this.items.map((i) => ({ x: i.x, width: cardWidth(i.game, compact) })),
      TIMELINE.laneGap,
      TIMELINE.maxShift,
    );
    const visible = this.items.filter((i) => i.node && !i.node.root.hidden);
    const before = new Map(visible.map((i) => [i, i.node!.card.el.getBoundingClientRect()]));
    const cards = [
      ...this.items.flatMap((i) => (i.node ? [i.node.card.el] : [])),
      ...this.tbaBlocks.flatMap((b) => b.slots.flatMap((s) => (s.card ? [s.card.el] : []))),
    ];
    if (animate) this.el.classList.add("is-restyling");
    morphParts(
      cards,
      () => {
        this.el.classList.toggle("is-compact", compact);
        this.items.forEach((item, k) => {
          item.width = cardWidth(item.game, compact);
          item.lane = lanes[k];
          if (item.node) this.placeNode(item);
        });
      },
      animate,
    );
    // Stops keep their order (same dates); only which side each card grows toward changed.
    this.stops = this.buildStops();
    this.fitCards();
    if (!animate) return;
    // FLIP: from where each card was to its new place, measured on the edge facing the line.
    for (const [item, old] of before) {
      const el = item.node!.card.el;
      const now = el.getBoundingClientRect();
      const above = item.lane.side === "above";
      const dx = old.left - now.left;
      const dy = above ? old.bottom - now.bottom : old.top - now.top;
      const scale = this.cardScale || 1;
      const selected = this.selected >= 0 && this.stops[this.selected].game === item.game;
      // The selected card's `y` belongs to its fit-in-view nudge: horizontal glide only.
      gsap.from(el, { x: dx / scale, ...(selected ? {} : { y: dy / scale }), duration: MORPH_SECONDS, ease: "power2.out" });
      gsap.from(item.node!.connectors, { opacity: 0, duration: MORPH_SECONDS, ease: "power1.in" });
    }
    setTimeout(() => this.el.classList.remove("is-restyling"), MORPH_SECONDS * 1000 + 50);
  }

  /** The stub ends where the scaled group puts the connector, so it follows `--card-scale`. */
  private drawStub(node: { stubPath: SVGPathElement; targetX: number; dir: number }) {
    const off = TIMELINE.cardOffset * node.dir;
    const tx = node.targetX * this.cardScale;
    node.stubPath.setAttribute("d", tx === 0 ? `M0 0 V${off}` : `M0 0 V${off / 2} H${tx} V${off}`);
  }


  private createMinimap() {
    const months = [];
    for (let day = this.startDay; day <= this.endDay; day++) {
      const date = dayToDate(day);
      if (date.getUTCDate() !== 1) continue;
      const m = date.getUTCMonth();
      months.push({
        x: this.dayX(day),
        label: m === 0 ? String(date.getUTCFullYear()) : MONTHS[m].slice(0, 3),
        major: m === 0,
      });
    }
    const dots = [
      ...this.items.map((i) => ({ x: i.x, game: i.game })),
      ...this.tbaBlocks.flatMap((b) => b.slots.map((s) => ({ x: s.x, game: s.game }))),
    ].map(({ x, game }) => ({
      x,
      id: game.id,
      kind: game.kind,
      fresh: !!news.unseenFor(game.id),
      upcoming: !game.firstReleaseDate || parseDay(game.firstReleaseDate) > this.todayDay,
      title: game.title,
    }));
    return new Minimap({
      worldEnd: this.worldEnd,
      months,
      dots,
      todayX: this.dayX(this.todayDay),
      tba: this.tbaBlocks.length ? { startX: this.tbaStartX, endX: this.worldEnd } : null,
      onSeek: (x, smooth) => {
        this.deselect();
        if (smooth) this.scroller.scrollTo(x);
        else this.scroller.jumpTo(x);
      },
      onSeekEnd: () => this.scroller.settle(),
    });
  }

  /** Same lazy creation / one-shot reveal as dated cards, per TBA year block. */
  private updateTba(left: number, canReveal: boolean) {
    const right = left + this.width;
    const margin = TIMELINE.cullMarginPx;
    for (const block of this.tbaBlocks) {
      const inRange = block.x + block.width > left - margin && block.x < right + margin;
      if (inRange && !block.node) this.createTbaNode(block);
      const keep =
        inRange ||
        (!!block.node && (block.node.contains(document.activeElement) || block.slots.some((s) => this.isCurrentCard(s.card!.el))));
      if (block.node && keep !== !block.node.hidden) block.node.hidden = !keep;
      block.inRange = inRange;

      if (!block.node) continue;
      for (const slot of block.slots) {
        if (canReveal && !slot.revealed && slot.x >= left && slot.x <= right) {
          slot.revealed = true;
          revealCard(null, slot.card!, "above", this.opening);
        }
      }
    }
  }

  private createTbaNode(block: TbaBlock) {
    block.node = createTbaBlockNode(block, this.todayDay);
    this.world.append(block.node);
    for (const slot of block.slots) {
      hideCard(null, slot.card!);
      slot.card!.el.querySelectorAll("a").forEach((a) => (a.tabIndex = -1));
    }
  }

  /** Header text: year / month on the dated line, block year / "Date TBA" in the TBA zone. */
  /** Header: "2026 · September · Sat 26" under the playhead; block label / "Date TBA" in the TBA zone. */
  private headerText(center: number): [string, string, string] {
    const tbaThreshold = this.tbaStartX - TIMELINE.tbaGapPx / 2;
    if (this.tbaBlocks.length && center >= tbaThreshold) {
      const half = TBA_LAYOUT.blockGap / 2;
      const block = [...this.tbaBlocks].reverse().find((b) => center >= b.x - half) ?? this.tbaBlocks[0];
      // The no-year block is labelled "TBA" itself: say it once.
      return block.label === "TBA" ? ["Date TBA", "", ""] : [block.label, "Date TBA", ""];
    }
    const date = dayToDate(this.dayAt(center));
    return [
      String(date.getUTCFullYear()),
      MONTHS[date.getUTCMonth()],
      `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()}`,
    ];
  }

  /** Calendar day under world x (clamped to the dated line). */
  private dayAt(x: number) {
    return Math.min(this.endDay, Math.max(this.startDay, this.startDay + Math.round(x / TIMELINE.dayPx)));
  }

  /** Every glide on the dated line rests exactly on a day; the TBA zone is free. */
  private snapToDay(x: number) {
    const lastDayX = this.dayX(this.endDay);
    if (x > lastDayX + TIMELINE.dayPx / 2) return x;
    return Math.round(x / TIMELINE.dayPx) * TIMELINE.dayPx;
  }

  /** Render only cards near the viewport; reveal each once its date is on screen. */
  private updateItems(left: number, canReveal: boolean) {
    const right = left + this.width;
    const margin = TIMELINE.cullMarginPx;
    for (const item of this.items) {
      const reach = item.width / 2 + item.lane.shift + item.lane.level * TIMELINE.stackStepX;
      const inRange = item.x + reach > left - margin && item.x - reach < right + margin;
      if (inRange && !item.node) item.node = this.createNode(item);
      // Never hide the tabbable or focused card, or Tab / focus would be lost.
      const keep = inRange || (!!item.node && (item.node.root.contains(document.activeElement) || this.isCurrentCard(item.node.card.el)));
      if (item.node && keep !== !item.node.root.hidden) item.node.root.hidden = !keep;
      item.inRange = inRange;

      if (canReveal && item.node && !item.revealed && item.x >= left && item.x <= right) {
        item.revealed = true;
        revealCard(item.node.connectors, item.node.card, item.lane.side, this.opening);
      }
    }
  }

  private readPalette() {
    const css = getComputedStyle(document.documentElement);
    const v = (name: string) => css.getPropertyValue(name).trim();
    this.palette = {
      line: v("--timeline"),
      monthBand: v("--month-band"),
      tick: v("--tick"),
      label: v("--text-muted"),
      accent: v("--accent"),
      onAccent: "#fff",
      font: getComputedStyle(document.body).fontFamily,
    };
  }

  private watchTheme() {
    const refresh = () => {
      this.readPalette();
      this.render(this.scroller.current);
    };
    const themeObserver = new MutationObserver(refresh);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const scheme = matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", refresh);
    this.disposers.push(
      () => themeObserver.disconnect(),
      () => scheme.removeEventListener("change", refresh),
    );
  }

  private resize() {
    const dpr = window.devicePixelRatio || 1;
    this.width = this.el.clientWidth;
    this.height = this.el.clientHeight;
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.lineY = Math.round((this.height - TIMELINE.minimapBandPx) / 2);
    this.world.style.top = `${this.lineY}px`;
    // From above the tallest tick to below the month labels.
    this.band.style.top = `${this.lineY - 34}px`;
    this.band.style.height = `${34 + TIMELINE.cardOffset + 2}px`;
    this.fitCards();
    this.scroller.setBounds(0, this.worldEnd);
  }

  private render(center: number) {
    if (this.destroyed) return;
    const left = center - this.width / 2;
    this.world.style.transform = `translate3d(${-left}px, 0, 0)`;
    this.drawCanvas(left);
    // Before the initial jump to today, don't create or reveal any cards.
    if (this.ready) {
      this.setCurrent(this.selected >= 0 ? this.selected : this.nearestStop(center));
      // During a long glide (e.g. a minimap jump) cards flying past keep their one-shot entrance.
      const settling = Math.abs(this.scroller.target - center) < this.width;
      this.updateItems(left, settling);
      this.updateTba(left, settling);
    }
    this.minimap.update(left, this.width);

    this.header.update(this.headerText(center), Math.sign(center - this.lastCenter), this.ready && !this.opening);
    // No days in the TBA zone, so no playhead there.
    this.el.classList.toggle("in-tba", this.tbaBlocks.length > 0 && center >= this.tbaStartX - TIMELINE.tbaGapPx / 2);
    this.lastCenter = center;
  }

  /**
   * Every other month barely tinted, from the top to the minimap (ITERATION-4 §5),
   * on the dated line only: the TBA zone has its own blocks.
   */
  private drawMonthBands(left: number) {
    const { ctx, width, palette } = this;
    const lineStart = this.dayX(this.startDay) - left;
    const lineEnd = this.dayX(this.endDay + 1) - left;
    const bottom = this.height - TIMELINE.minimapBandPx;
    const first = dayToDate(this.dayAt(left));
    ctx.fillStyle = palette.monthBand;
    for (let y = first.getUTCFullYear(), m = first.getUTCMonth(); ; m++) {
      if (m === 12) [y, m] = [y + 1, 0];
      const from = this.dayX(Date.UTC(y, m, 1) / 86_400_000) - left;
      if (from > width || from > lineEnd) break;
      if ((y * 12 + m) % 2 === 0) continue;
      const to = this.dayX(Date.UTC(y, m + 1, 1) / 86_400_000) - left;
      const x0 = Math.max(from, lineStart, 0);
      const x1 = Math.min(to, lineEnd, width);
      if (x1 > x0) ctx.fillRect(x0, 0, x1 - x0, bottom);
    }
  }

  private drawCanvas(left: number) {
    const { ctx, width, height, palette } = this;
    const dayPx = TIMELINE.dayPx;
    const y = this.lineY;

    ctx.clearRect(0, 0, width, height);
    this.drawMonthBands(left);

    // --- Line: solid in the past, dashed and lighter in the future.
    const startX = this.dayX(this.startDay) - left;
    const todayX = this.dayX(this.todayDay) - left;
    const endX = this.dayX(this.endDay) - left;
    ctx.lineCap = "round";
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.moveTo(Math.max(startX, -10), y);
    ctx.lineTo(Math.min(todayX, width + 10), y);
    ctx.stroke();

    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = left; // dashes stay fixed to the world while scrolling
    ctx.beginPath();
    ctx.moveTo(Math.max(todayX, -10), y);
    ctx.lineTo(Math.min(endX, width + 10), y);
    ctx.stroke();
    ctx.restore();

    // Break mark in the gap, then a faint dotted guide through the TBA zone.
    if (this.tbaBlocks.length) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 3;
      const bx = endX + TIMELINE.tbaGapPx / 2;
      for (const dx of [-5, 5]) {
        ctx.beginPath();
        ctx.moveTo(bx + dx - 5, y + 10);
        ctx.lineTo(bx + dx + 5, y - 10);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 8]);
      ctx.lineDashOffset = left;
      ctx.beginPath();
      ctx.moveTo(Math.max(this.tbaStartX - left, -10), y);
      ctx.lineTo(Math.min(this.worldEnd - left, width + 10), y);
      ctx.stroke();
      ctx.restore();
    }

    // Start cap.
    if (startX > -10 && startX < width + 10) {
      ctx.fillStyle = palette.line;
      ctx.beginPath();
      ctx.arc(startX, y, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- Ticks: only the visible days.
    const first = Math.max(0, Math.floor(left / dayPx) - 1);
    const last = Math.min(this.endDay - this.startDay, Math.ceil((left + width) / dayPx) + 1);
    const center = left + width / 2;
    // Day under the playhead, or none in the TBA zone.
    const centerIndex = center <= this.dayX(this.endDay) + dayPx / 2 ? this.dayAt(center) - this.startDay : -1;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    for (let i = first; i <= last; i++) {
      const day = this.startDay + i;
      const date = dayToDate(day);
      const x = Math.round(i * dayPx - left);
      ctx.globalAlpha = day > this.todayDay ? 0.55 : 1;

      let half: number;
      let w: number;
      if (date.getUTCDate() === 1) {
        half = 22;
        w = 2;
      } else if (date.getUTCDay() === 1) {
        half = 11;
        w = 1.5;
      } else {
        half = 5;
        w = 1;
      }
      ctx.fillStyle = palette.tick;
      ctx.fillRect(x - w / 2, y - half, w, half * 2);

      // Day numbers under 1, 5, 10, 15, 20, 25 (the playhead day is drawn below, larger).
      if (i !== centerIndex && TIMELINE.labeledDays.includes(date.getUTCDate())) {
        ctx.fillStyle = palette.label;
        ctx.font = `700 11px ${palette.font}`;
        ctx.fillText(String(date.getUTCDate()), x, y + 27);
      }

      if (date.getUTCDate() === 1 || i === 0) {
        const month = MONTHS[date.getUTCMonth()].slice(0, 3).toUpperCase();
        const label =
          i === 0
            ? `${month} ${date.getUTCDate()}, ${date.getUTCFullYear()}`
            : date.getUTCMonth() === 0
              ? `${month} ${date.getUTCFullYear()}`
              : month;
        ctx.fillStyle = palette.label;
        ctx.font = `800 13px ${palette.font}`;
        ctx.fillText(label, x, y + 46);
      }
    }

    // --- The day under the playhead: accent tick and its number in a pill.
    if (centerIndex >= first && centerIndex <= last) {
      const x = Math.round(centerIndex * dayPx - left);
      const label = String(dayToDate(this.startDay + centerIndex).getUTCDate());
      ctx.globalAlpha = 1;
      ctx.fillStyle = palette.accent;
      ctx.fillRect(x - 1.5, y - 16, 3, 32);
      ctx.font = `900 14px ${palette.font}`;
      const pillW = Math.max(26, ctx.measureText(label).width + 14);
      ctx.beginPath();
      ctx.roundRect(x - pillW / 2, y + 22, pillW, 22, 11);
      ctx.fill();
      ctx.fillStyle = palette.onAccent;
      ctx.textBaseline = "middle";
      ctx.fillText(label, x, y + 33.5);
      ctx.textBaseline = "top";
    }
    ctx.globalAlpha = 1;
  }
}
