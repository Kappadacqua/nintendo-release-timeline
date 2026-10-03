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
  months: { x: number; label: string; major: boolean }[];
  dots: MinimapDot[];
  todayX: number;
  tba: { startX: number; endX: number } | null;
  /** Called with a world x (as the new viewport center). `smooth` is false while scrubbing. */
  onSeek: (x: number, smooth: boolean) => void;
  /** Scrubbing ended (the timeline snaps to the nearest day). */
  onSeekEnd?: () => void;
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

    const pct = (x: number) => `${(x / opts.worldEnd) * 100}%`;
    const add = (className: string, left: number, text?: string) => {
      const node = document.createElement("div");
      node.className = className;
      node.style[this.start] = pct(left);
      if (text) node.textContent = text;
      this.track.append(node);
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
    this.track.append(this.window);

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
    const [start, length] = this.trackSpan();
    const ratio = Math.min(1, Math.max(0, (client - start) / length));
    return ratio * this.opts.worldEnd;
  }

  private overWindow(client: number) {
    const r = this.window.getBoundingClientRect();
    // A finger needs a little more room on a thin window.
    const slack = this.vertical ? 6 : 0;
    return this.vertical ? client >= r.top - slack && client <= r.bottom + slack : client >= r.left && client <= r.right;
  }

  /** The dot nearest to a pointer position along the bar, within `reach` px. */
  private dotAt(client: number, reach: number) {
    const [start, length] = this.trackSpan();
    let best: MinimapDot | null = null;
    let bestD = reach;
    for (const dot of this.opts.dots) {
      const d = Math.abs(start + (dot.x / this.opts.worldEnd) * length - client);
      if (d <= bestD) [best, bestD] = [dot, d];
    }
    return best ? { dot: best, at: start + (best.x / this.opts.worldEnd) * length } : null;
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
