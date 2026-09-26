export interface MinimapOptions {
  /** World x range shown by the bar: [0, worldEnd]. */
  worldEnd: number;
  months: { x: number; label: string; major: boolean }[];
  dots: { x: number; kind: string; upcoming: boolean; title: string }[];
  todayX: number;
  tba: { startX: number; endX: number } | null;
  /** Called with a world x (as the new viewport center). `smooth` is false while scrubbing. */
  onSeek: (x: number, smooth: boolean) => void;
}

/** Thin overview bar: months, one dot per game, the visible window; click or drag to jump. */
export class Minimap {
  readonly el: HTMLElement;
  private readonly track: HTMLElement;
  private readonly window: HTMLElement;

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
      const dot = add(`minimap__dot minimap__dot--${d.kind}${d.upcoming ? " is-upcoming" : ""}`, d.x);
      dot.title = d.title;
    }

    this.window = document.createElement("div");
    this.window.className = "minimap__window";
    this.track.append(this.window);

    this.bindSeek();
  }

  /** Reflect the visible world range [left, left + width]. */
  update(left: number, width: number) {
    const { worldEnd } = this.opts;
    this.window.style.left = `${(left / worldEnd) * 100}%`;
    this.window.style.width = `${(width / worldEnd) * 100}%`;
  }

  private worldXAt(clientX: number) {
    const rect = this.track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return ratio * this.opts.worldEnd;
  }

  private bindSeek() {
    let scrubbing = false;
    this.el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      // Keep the timeline's own drag-to-scroll out of it.
      e.stopPropagation();
      scrubbing = true;
      this.el.setPointerCapture(e.pointerId);
      this.el.classList.add("is-scrubbing");
      this.opts.onSeek(this.worldXAt(e.clientX), true);
    });
    this.el.addEventListener("pointermove", (e) => {
      if (scrubbing) this.opts.onSeek(this.worldXAt(e.clientX), false);
    });
    const end = () => {
      scrubbing = false;
      this.el.classList.remove("is-scrubbing");
    };
    this.el.addEventListener("pointerup", end);
    this.el.addEventListener("pointercancel", end);
  }
}
