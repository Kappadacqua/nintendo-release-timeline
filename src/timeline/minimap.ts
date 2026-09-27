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

  constructor(private readonly opts: MinimapOptions) {
    this.el = document.createElement("div");
    this.el.className = "minimap";
    this.el.setAttribute("aria-label", "Timeline overview. Click to jump.");

    this.track = document.createElement("div");
    this.track.className = "minimap__track";
    this.el.append(this.track);

    const pct = (x: number) => `${(x / opts.worldEnd) * 100}%`;
    const add = (className: string, left: number, text?: string) => {
      const node = document.createElement("div");
      node.className = className;
      node.style.left = pct(left);
      if (text) node.textContent = text;
      this.track.append(node);
      return node;
    };

    for (const m of opts.months) add(`minimap__month${m.major ? " minimap__month--major" : ""}`, m.x, m.label);

    if (opts.tba) {
      const zone = add("minimap__tba", opts.tba.startX, "TBA");
      zone.style.width = pct(opts.tba.endX - opts.tba.startX);
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
    this.window.style.left = `${(left / worldEnd) * 100}%`;
    this.window.style.width = `${(width / worldEnd) * 100}%`;
    this.center = left + width / 2;
  }

  private worldXAt(clientX: number) {
    const rect = this.track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return ratio * this.opts.worldEnd;
  }

  private overWindow(clientX: number) {
    const r = this.window.getBoundingClientRect();
    return clientX >= r.left && clientX <= r.right;
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
    this.el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      // Keep the timeline's own drag-to-scroll out of it.
      e.stopPropagation();
      this.el.setPointerCapture(e.pointerId);
      this.hidePreview();
      startX = e.clientX;
      moved = false;
      if (this.overWindow(e.clientX)) {
        mode = "window";
        offset = this.worldXAt(e.clientX) - this.center;
        return;
      }
      mode = "scrub";
      this.el.classList.add("is-scrubbing");
      this.opts.onSeek(this.worldXAt(e.clientX), true);
    });
    this.el.addEventListener("pointermove", (e) => {
      if (mode === "scrub") this.opts.onSeek(this.worldXAt(e.clientX), false);
      if (mode !== "window") return;
      if (!moved && Math.abs(e.clientX - startX) < DRAG_PX) return;
      moved = true;
      this.el.classList.add("is-scrubbing");
      this.opts.onSeek(this.worldXAt(e.clientX) - offset, false);
    });
    const end = (e: PointerEvent) => {
      if (mode === "window" && !moved) this.opts.onSeek(this.worldXAt(e.clientX), true);
      else if (mode) this.opts.onSeekEnd?.();
      mode = null;
      this.el.classList.remove("is-scrubbing");
    };
    this.el.addEventListener("pointerup", end);
    this.el.addEventListener("pointercancel", end);
  }

  private bindPreview() {
    this.el.addEventListener("pointermove", (e) => {
      if (this.el.classList.contains("is-scrubbing")) return this.hidePreview();
      this.el.classList.toggle("is-over-window", this.overWindow(e.clientX));
      const rect = this.track.getBoundingClientRect();
      let best: MinimapDot | null = null;
      let bestD = HOVER_PX;
      for (const dot of this.opts.dots) {
        const d = Math.abs(rect.left + (dot.x / this.opts.worldEnd) * rect.width - e.clientX);
        if (d <= bestD) [best, bestD] = [dot, d];
      }
      if (best) this.showPreview(best, rect.left + (best.x / this.opts.worldEnd) * rect.width);
      else this.hidePreview();
    });
    this.el.addEventListener("pointerleave", () => {
      this.hidePreview();
      this.el.classList.remove("is-over-window");
    });
  }

  private shown: MinimapDot | null = null;

  private showPreview(dot: MinimapDot, clientX: number) {
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
    // Centered on the dot, kept inside the bar.
    const bar = this.el.getBoundingClientRect();
    const half = this.preview.offsetWidth / 2;
    const x = Math.min(bar.width - half - 4, Math.max(half + 4, clientX - bar.left));
    this.preview.style.left = `${x}px`;
  }

  private hidePreview() {
    this.shown = null;
    this.preview.hidden = true;
  }
}
