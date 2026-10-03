/** Shown in the hover preview (ITERATION-4 §7); several for a group of same-day games. */
export interface MinimapPreview {
  title: string;
  coverUrl: string;
  when: string;
}

export interface MinimapDot {
  x: number;
  /** Game ids (several for a same-day group). */
  ids: string[];
  kind: string;
  group: boolean;
  upcoming: boolean;
  fresh: boolean;
  games: MinimapPreview[];
}

export interface MinimapOptions {
  /** Vertical strip on the right (SPEC "Mobile"): the world runs from top to bottom. */
  vertical?: boolean;
  /** World x range shown by the bar: [0, worldEnd]. */
  worldEnd: number;
  /**
   * World length of a month and the fewest px a month may take on the bar: once the whole range
   * no longer fits at that density, the bar shows part of it and scrolls with the view.
   */
  monthPx?: number;
  minMonthPx?: number;
  months: { x: number; label: string; major: boolean }[];
  dots: MinimapDot[];
  todayX: number;
  tba: { startX: number; endX: number } | null;
  /** Called with a world x (as the new viewport center). `smooth` is false while scrubbing. */
  onSeek: (x: number, smooth: boolean) => void;
  /** Scrubbing ended (the timeline snaps to the nearest day). */
  onSeekEnd?: () => void;
}

/**
 * Minimap px per world px: the whole timeline on the track, unless a month would get fewer than
 * `minMonthPx` (then the bar shows part of it and scrolls).
 */
export function minimapScale(trackLen: number, worldEnd: number, monthPx?: number, minMonthPx?: number) {
  const fit = trackLen / worldEnd;
  return monthPx && minMonthPx ? Math.max(fit, minMonthPx / monthPx) : fit;
}

/** World x at the track's start: the view's centre in the middle of the bar, within the timeline's ends. */
export function minimapOffset(center: number, trackLen: number, k: number, worldEnd: number) {
  const visible = trackLen / k;
  return Math.min(Math.max(0, worldEnd - visible), Math.max(0, center - visible / 2));
}

/** Pointer closer than this (px) to a dot shows its preview. */
const HOVER_PX = 7;
/** A press on the visible window that moves less than this is a click (jump there). */
const DRAG_PX = 3;
/** Touch: a tap this close to a dot (px) previews it; the preview stays this long. */
const TAP_PX = 14;
const TAP_PREVIEW_MS = 2600;

/**
 * Thin overview bar: months, one dot per game, the visible window. Click or drag to jump;
 * drag the window to move the view with it; hover a dot for a preview.
 */
export class Minimap {
  readonly el: HTMLElement;
  private readonly track: HTMLElement;
  /** Everything along the bar; longer than the track (and translated) once a month would get too few px. */
  private readonly strip: HTMLElement;
  /** Track length (px), minimap px per world px, and the world x at the track's start. */
  private trackLen = 0;
  private k = 1;
  private offset = 0;
  /** A press on the bar keeps it where it is (the view moving under the finger must not move it). */
  private holding = false;
  private readonly window: HTMLElement;
  private readonly preview: HTMLElement;
  /** World x of the view center, as last reported by `update`. */
  private center = 0;
  private readonly vertical: boolean;
  private tapTimer = 0;

  constructor(private readonly opts: MinimapOptions) {
    this.vertical = opts.vertical ?? false;
    this.el = document.createElement("div");
    this.el.className = `minimap${this.vertical ? " minimap--vertical" : ""}`;
    this.el.setAttribute("aria-label", "Timeline overview. Click to jump.");

    this.track = document.createElement("div");
    this.track.className = "minimap__track";
    this.el.append(this.track);
    this.strip = document.createElement("div");
    this.strip.className = "minimap__strip";
    this.track.append(this.strip);
    const sizeObserver = new ResizeObserver(() => this.measure());
    sizeObserver.observe(this.track);

    const pct = (x: number) => `${(x / opts.worldEnd) * 100}%`;
    const add = (className: string, left: number, text?: string) => {
      const node = document.createElement("div");
      node.className = className;
      node.style[this.start] = pct(left);
      if (text) node.textContent = text;
      this.strip.append(node);
      return node;
    };

    for (const m of opts.months) add(`minimap__month${m.major ? " minimap__month--major" : ""}`, m.x, m.label);

    if (opts.tba) {
      const zone = add("minimap__tba", opts.tba.startX, "TBA");
      zone.style[this.size] = pct(opts.tba.endX - opts.tba.startX);
    }

    add("minimap__today", opts.todayX);
    for (const d of opts.dots) {
      const dot = add(
        `minimap__dot minimap__dot--${d.kind}${d.group ? " minimap__dot--group" : ""}${d.upcoming ? " is-upcoming" : ""}${d.fresh ? " has-news" : ""}`,
        d.x,
      );
      dot.dataset.gameIds = d.ids.join(" ");
    }

    this.window = document.createElement("div");
    this.window.className = "minimap__window";
    this.strip.append(this.window);

    this.preview = document.createElement("div");
    this.preview.className = "minimap__preview";
    this.preview.hidden = true;
    this.preview.setAttribute("aria-hidden", "true");
    this.el.append(this.preview);

    this.bindSeek();
    this.bindPreview();
  }

  /** Reflect the visible world range [left, left + width]. */
  update(left: number, width: number) {
    const { worldEnd } = this.opts;
    this.window.style[this.start] = `${(left / worldEnd) * 100}%`;
    this.window.style[this.size] = `${(width / worldEnd) * 100}%`;
    this.center = left + width / 2;
    this.follow();
  }

  /** Track size changed: the density, hence whether (and how far) the strip scrolls. */
  private measure() {
    const rect = this.track.getBoundingClientRect();
    this.trackLen = this.vertical ? rect.height : rect.width;
    if (!this.trackLen) return;
    const { worldEnd, monthPx, minMonthPx } = this.opts;
    this.k = minimapScale(this.trackLen, worldEnd, monthPx, minMonthPx);
    const ratio = (worldEnd * this.k) / this.trackLen;
    // Fits: the strip is the track itself (no rounding that would move the month lines by a pixel).
    this.strip.style[this.size] = ratio > 1.0001 ? `${ratio * 100}%` : "";
    this.follow();
  }

  /** Scrolling strip: the view's window stays centred on the bar, within the strip's ends. */
  private follow() {
    if (!this.trackLen || this.holding) return;
    const max = Math.max(0, this.opts.worldEnd - this.trackLen / this.k);
    this.offset = minimapOffset(this.center, this.trackLen, this.k, this.opts.worldEnd);
    const shift = -this.offset * this.k;
    // Nothing to scroll (the whole timeline fits): no transform, the bar renders as it always did.
    this.strip.style.transform = max === 0 ? "" : this.vertical ? `translate3d(0, ${shift}px, 0)` : `translate3d(${shift}px, 0, 0)`;
    // A fade at an end that hides more of the timeline.
    this.track.classList.toggle("has-more-before", this.offset > 0.5);
    this.track.classList.toggle("has-more-after", this.offset < max - 0.5);
  }

  /** CSS properties along the bar: left / width, or top / height on the vertical strip. */
  private get start() {
    return this.vertical ? "top" : "left";
  }

  private get size() {
    return this.vertical ? "height" : "width";
  }

  /** Pointer position along the bar. */
  private along(e: { clientX: number; clientY: number }) {
    return this.vertical ? e.clientY : e.clientX;
  }

  /** The track's extent along the bar, in client px: [start, length]. */
  private trackSpan() {
    const rect = this.track.getBoundingClientRect();
    return this.vertical ? [rect.top, rect.height] : [rect.left, rect.width];
  }

  private worldXAt(client: number) {
    const [start] = this.trackSpan();
    return Math.min(this.opts.worldEnd, Math.max(0, (client - start) / this.k + this.offset));
  }

  /** Client position (along the bar) of a world x. */
  private clientAt(x: number) {
    return this.trackSpan()[0] + (x - this.offset) * this.k;
  }

  private overWindow(client: number) {
    const r = this.window.getBoundingClientRect();
    // A finger needs a little more room on a thin window.
    const slack = this.vertical ? 6 : 0;
    return this.vertical ? client >= r.top - slack && client <= r.bottom + slack : client >= r.left && client <= r.right;
  }

  /** The dot nearest to a pointer position along the bar, within `reach` px. */
  private dotAt(client: number, reach: number) {
    let best: MinimapDot | null = null;
    let bestD = reach;
    for (const dot of this.opts.dots) {
      const d = Math.abs(this.clientAt(dot.x) - client);
      if (d <= bestD) [best, bestD] = [dot, d];
    }
    return best ? { dot: best, at: this.clientAt(best.x) } : null;
  }

  /**
   * Press outside the window: jump there and follow the pointer (as before). Press on the
   * window: drag it, the view follows in real time; without moving it is a plain click.
   */
  private bindSeek() {
    let mode: "scrub" | "window" | null = null;
    let offset = 0;
    let startX = 0;
    let moved = false;
    let scrubMoved = false;
    this.el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      // Keep the timeline's own drag-to-scroll out of it.
      e.stopPropagation();
      this.el.setPointerCapture(e.pointerId);
      this.holding = true;
      this.hidePreview();
      startX = this.along(e);
      moved = false;
      scrubMoved = false;
      if (this.overWindow(this.along(e))) {
        mode = "window";
        offset = this.worldXAt(this.along(e)) - this.center;
        return;
      }
      mode = "scrub";
      this.el.classList.add("is-scrubbing");
      this.opts.onSeek(this.worldXAt(this.along(e)), true);
    });
    this.el.addEventListener("pointermove", (e) => {
      if (mode === "scrub") {
        if (Math.abs(this.along(e) - startX) >= DRAG_PX) scrubMoved = true;
        this.opts.onSeek(this.worldXAt(this.along(e)), false);
      }
      if (mode !== "window") return;
      if (!moved && Math.abs(this.along(e) - startX) < DRAG_PX) return;
      moved = true;
      this.el.classList.add("is-scrubbing");
      this.opts.onSeek(this.worldXAt(this.along(e)) - offset, false);
    });
    const end = (e: PointerEvent) => {
      const tap = (mode === "window" && !moved) || (mode === "scrub" && !scrubMoved);
      if (mode === "window" && !moved) this.opts.onSeek(this.worldXAt(this.along(e)), true);
      else if (mode) this.opts.onSeekEnd?.();
      mode = null;
      this.holding = false;
      this.follow();
      this.el.classList.remove("is-scrubbing");
      // Touch has no hover: a tap near a dot shows its preview for a moment (SPEC "Mobile").
      if (tap && e.type === "pointerup" && e.pointerType !== "mouse") this.tapPreview(this.along(e));
    };
    this.el.addEventListener("pointerup", end);
    this.el.addEventListener("pointercancel", end);
  }

  private bindPreview() {
    this.el.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      if (this.el.classList.contains("is-scrubbing")) return this.hidePreview();
      this.el.classList.toggle("is-over-window", this.overWindow(this.along(e)));
      const hit = this.dotAt(this.along(e), HOVER_PX);
      if (hit) this.showPreview(hit.dot, hit.at);
      else this.hidePreview();
    });
    this.el.addEventListener("pointerleave", (e) => {
      if (e.pointerType !== "mouse") return;
      this.hidePreview();
      this.el.classList.remove("is-over-window");
    });
  }

  private tapPreview(client: number) {
    const hit = this.dotAt(client, TAP_PX);
    if (!hit) return;
    this.showPreview(hit.dot, hit.at);
    clearTimeout(this.tapTimer);
    this.tapTimer = window.setTimeout(() => this.hidePreview(), TAP_PREVIEW_MS);
  }

  private shown: MinimapDot | null = null;

  private showPreview(dot: MinimapDot, client: number) {
    if (this.shown !== dot) {
      this.shown = dot;
      this.preview.replaceChildren(
        ...dot.games.map((g) => {
          const row = document.createElement("div");
          row.className = "minimap__preview-game";
          row.innerHTML = `<img alt=""><span><strong></strong><small></small></span>`;
          row.querySelector("img")!.src = g.coverUrl;
          row.querySelector("strong")!.textContent = g.title;
          row.querySelector("small")!.textContent = g.when;
          return row;
        }),
      );
      this.preview.hidden = false;
    }
    // Centered on the dot, kept inside the bar (vertical: beside the strip, inside the screen).
    const bar = this.el.getBoundingClientRect();
    if (this.vertical) {
      const half = this.preview.offsetHeight / 2;
      const room = innerHeight - bar.top;
      this.preview.style.top = `${Math.min(room - half - 8, Math.max(half + 8 - bar.top, client - bar.top))}px`;
      return;
    }
    const half = this.preview.offsetWidth / 2;
    const x = Math.min(bar.width - half - 4, Math.max(half + 4, client - bar.left));
    this.preview.style.left = `${x}px`;
  }

  private hidePreview() {
    clearTimeout(this.tapTimer);
    this.shown = null;
    this.preview.hidden = true;
  }
}
