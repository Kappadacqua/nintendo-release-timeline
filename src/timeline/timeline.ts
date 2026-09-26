import { hideCard, revealCard } from "../cards/appear";
import { type Card, cardWidth, createCard } from "../cards/card";
import { assignLanes, type Lane } from "../cards/layout";
import type { Game } from "../types";
import { TIMELINE } from "./config";
import { dayToDate, MONTHS, parseDay, todayEpochDay } from "./dates";
import { TimelineHeader } from "./header";
import { Minimap } from "./minimap";
import { bindScrollInput, Scroller } from "./scroller";
import { createTbaBlockNode, layoutTba, TBA_LAYOUT, type TbaBlock } from "./tba";

interface Item {
  game: Game;
  x: number;
  width: number;
  lane: Lane;
  /** Created lazily the first time the item comes near the viewport. */
  node?: { root: HTMLElement; connector: SVGSVGElement; card: Card };
  inRange: boolean;
  revealed: boolean;
}

/** A game the keyboard can land on: dated card or TBA card, in timeline order. */
interface Stop {
  x: number;
  /** Creates the card on demand and returns it. */
  card: () => HTMLElement;
}

interface Palette {
  line: string;
  tick: string;
  label: string;
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
  private readonly stops: Stop[];
  /** Index in `stops` of the tabbable card (the one nearest the center). */
  private current = -1;
  /** True while focus is moved by the timeline itself, which must not re-center the view. */
  private movingFocus = false;

  constructor(root: HTMLElement, games: Game[], headerSlot?: HTMLElement) {
    const lastRelease = games
      .flatMap((g) => Object.values(g.releaseDates))
      .filter((d): d is string => !!d)
      .reduce((max, d) => Math.max(max, parseDay(d)), this.startDay);
    this.endDay = Math.max(lastRelease, this.todayDay) + TIMELINE.endMarginDays;

    this.el = document.createElement("div");
    this.el.className = "timeline";
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

    const tba = layoutTba(
      games.filter((g) => !g.firstReleaseDate),
      this.dayX(this.endDay) + TIMELINE.tbaGapPx,
    );
    this.tbaBlocks = tba.blocks;
    this.tbaStartX = this.tbaBlocks.length ? this.tbaBlocks[0].x : this.dayX(this.endDay);
    this.worldEnd = Math.max(tba.endX, this.dayX(this.endDay));

    this.stops = this.buildStops();

    this.minimap = this.createMinimap();
    this.el.append(this.canvas, this.world, this.minimap.el);
    (headerSlot ?? this.el).append(this.header.el);
    root.append(this.el);
    this.el.addEventListener("focusin", (e) => this.onFocusIn(e));

    this.scroller = new Scroller((x) => this.render(x));
    bindScrollInput(this.el, this.scroller, {
      dayPx: TIMELINE.dayPx,
      onToday: () => this.scroller.scrollTo(this.dayX(this.todayDay)),
      onHome: () => this.goHome(),
      onEnd: () => this.scroller.scrollTo(this.worldEnd),
      onGameStep: (direction) => this.stepGame(direction),
      onKeyNavigate: () => this.followWithFocus(),
    });

    this.readPalette();
    this.watchTheme();
    new ResizeObserver(() => this.resize()).observe(this.el);
    this.resize();
    this.scroller.jumpTo(this.dayX(this.todayDay));
    this.ready = true;
    this.render(this.scroller.current);
    // Month labels use the web font; redraw once it has loaded.
    document.fonts.ready.then(() => this.render(this.scroller.current));
  }

  /** Home: go to today; if already there, go to the start of the line. */
  private goHome() {
    const todayX = this.dayX(this.todayDay);
    this.scroller.scrollTo(Math.abs(this.scroller.target - todayX) < 1 ? 0 : todayX);
  }

  /** Center the next / previous game (dated or TBA) relative to where the scroll is heading. */
  private stepGame(direction: 1 | -1) {
    const xs = [...this.items.map((i) => i.x), ...this.tbaBlocks.flatMap((b) => b.slots.map((s) => s.x))].sort(
      (a, b) => a - b,
    );
    const from = this.scroller.target;
    const next = direction > 0 ? xs.find((x) => x > from + 1) : [...xs].reverse().find((x) => x < from - 1);
    if (next !== undefined) this.scroller.scrollTo(next);
  }

  private buildStops(): Stop[] {
    const dated: Stop[] = this.items.map((item) => ({
      x: item.x,
      card: () => (item.node ??= this.createNode(item)).card.el,
    }));
    const tba: Stop[] = this.tbaBlocks.flatMap((block) =>
      block.slots.map((slot) => ({
        x: slot.x,
        card: () => {
          if (!block.node) this.createTbaNode(block);
          return slot.card!.el;
        },
      })),
    );
    return [...dated, ...tba].sort((a, b) => a.x - b.x);
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
    const index = this.stops.findIndex((s) => s.card() === card);
    if (index < 0) return;
    this.setCurrent(index);
    if (Math.abs(this.scroller.target - this.stops[index].x) > 1) this.scroller.scrollTo(this.stops[index].x);
  }

  /** After keyboard navigation, focus follows the game nearest to where the view is heading. */
  private followWithFocus() {
    if (!this.el.contains(document.activeElement)) return;
    const index = this.nearestStop(this.scroller.target);
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
    const need = TIMELINE.cardOffset + TIMELINE.cardMaxHeight + maxLevel * TIMELINE.stackStepY + 12;
    const room = Math.min(this.lineY, this.height - TIMELINE.minimapBandPx - this.lineY);
    const scale = Math.max(TIMELINE.minCardScale, Math.min(1, room / need));
    this.el.style.setProperty("--card-scale", scale.toFixed(3));
  }

  private dayX(day: number) {
    return (day - this.startDay) * TIMELINE.dayPx;
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
      .map((game) => ({ game, x: this.dayX(parseDay(game.firstReleaseDate!)), width: cardWidth(game) }))
      .sort((a, b) => a.x - b.x);
    const lanes = assignLanes(placed, TIMELINE.laneGap, TIMELINE.maxShift);
    return placed.map((p, i) => ({ ...p, lane: lanes[i], inRange: false, revealed: false }));
  }

  private createNode(item: Item) {
    const { side, level, shift } = item.lane;
    const root = document.createElement("div");
    root.className = `tl-item tl-item--${side}`;
    root.style.left = `${item.x}px`;
    root.style.zIndex = String(10 - level);

    const distance = TIMELINE.cardOffset + level * TIMELINE.stackStepY;
    const cardLeft = -item.width / 2 + shift + level * TIMELINE.stackStepX;

    // Straight connector when the card still sits over its date, elbow otherwise.
    const inset = 24;
    const dir = side === "above" ? -1 : 1;
    const targetX = cardLeft + inset <= 0 && 0 <= cardLeft + item.width - inset ? 0 : cardLeft + inset;
    const path =
      targetX === 0
        ? `M0 0 V${dir * distance}`
        : `M0 0 V${(dir * distance) / 2} H${targetX} V${dir * distance}`;
    const svgNs = "http://www.w3.org/2000/svg";
    const connector = document.createElementNS(svgNs, "svg");
    connector.setAttribute("class", "tl-item__connector");
    connector.setAttribute("aria-hidden", "true");
    const pathEl = document.createElementNS(svgNs, "path");
    pathEl.setAttribute("d", path);
    connector.append(pathEl);

    const dot = document.createElement("div");
    dot.className = "tl-item__dot";

    const card = createCard(item.game, this.todayDay);
    card.el.style.left = `${cardLeft}px`;
    card.el.style[side === "above" ? "bottom" : "top"] = `${distance}px`;

    root.append(connector, dot, card.el);
    this.world.append(root);
    hideCard(connector, card);
    return { root, connector, card };
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
      kind: game.kind,
      upcoming: !game.firstReleaseDate || parseDay(game.firstReleaseDate) > this.todayDay,
      title: game.title,
    }));
    return new Minimap({
      worldEnd: this.worldEnd,
      months,
      dots,
      todayX: this.dayX(this.todayDay),
      tba: this.tbaBlocks.length ? { startX: this.tbaStartX, endX: this.worldEnd } : null,
      onSeek: (x, smooth) => (smooth ? this.scroller.scrollTo(x) : this.scroller.jumpTo(x)),
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
          revealCard(null, slot.card!, "above");
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
  private headerText(center: number): [string, string] {
    const tbaThreshold = this.tbaStartX - TIMELINE.tbaGapPx / 2;
    if (this.tbaBlocks.length && center >= tbaThreshold) {
      const half = TBA_LAYOUT.blockGap / 2;
      const block = [...this.tbaBlocks].reverse().find((b) => center >= b.x - half) ?? this.tbaBlocks[0];
      return [block.label, "Date TBA"];
    }
    const day = Math.min(this.endDay, this.startDay + Math.round(center / TIMELINE.dayPx));
    const date = dayToDate(day);
    return [String(date.getUTCFullYear()), MONTHS[date.getUTCMonth()]];
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
        revealCard(item.node.connector, item.node.card, item.lane.side);
      }
    }
  }

  private readPalette() {
    const css = getComputedStyle(document.documentElement);
    const v = (name: string) => css.getPropertyValue(name).trim();
    this.palette = {
      line: v("--timeline"),
      tick: v("--tick"),
      label: v("--text-muted"),
      font: getComputedStyle(document.body).fontFamily,
    };
  }

  private watchTheme() {
    const refresh = () => {
      this.readPalette();
      this.render(this.scroller.current);
    };
    new MutationObserver(refresh).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", refresh);
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
    this.fitCards();
    this.scroller.setBounds(0, this.worldEnd);
  }

  private render(center: number) {
    const left = center - this.width / 2;
    this.world.style.transform = `translate3d(${-left}px, 0, 0)`;
    this.drawCanvas(left);
    // Before the initial jump to today, don't create or reveal any cards.
    if (this.ready) {
      this.setCurrent(this.nearestStop(center));
      // During a long glide (e.g. a minimap jump) cards flying past keep their one-shot entrance.
      const settling = Math.abs(this.scroller.target - center) < this.width;
      this.updateItems(left, settling);
      this.updateTba(left, settling);
    }
    this.minimap.update(left, this.width);

    const [primary, secondary] = this.headerText(center);
    this.header.update(primary, secondary, Math.sign(center - this.lastCenter), this.ready);
    this.lastCenter = center;
  }

  private drawCanvas(left: number) {
    const { ctx, width, height, palette } = this;
    const dayPx = TIMELINE.dayPx;
    const y = this.lineY;

    ctx.clearRect(0, 0, width, height);

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
    ctx.fillStyle = palette.tick;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    for (let i = first; i <= last; i++) {
      const day = this.startDay + i;
      const date = dayToDate(day);
      const x = Math.round(i * dayPx - left);
      const future = day > this.todayDay;
      ctx.globalAlpha = future ? 0.55 : 1;

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
      ctx.fillRect(x - w / 2, y - half, w, half * 2);

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
        ctx.fillText(label, x, y + 30);
        ctx.fillStyle = palette.tick;
      }
    }
    ctx.globalAlpha = 1;
  }
}
