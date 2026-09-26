import type { Game } from "../types";

/** IGDB cover URLs: used only as a last resort, so they get a much stronger blur. */
const isCover = (url: string) => url.includes("/t_cover_");

/**
 * Full-screen image of the selected game behind the whole site (ITERATION-2 §4).
 * Two stacked layers cross-fade (CSS, ~400ms); a new image is shown only once
 * loaded, and only if it is still the one asked for.
 */
export class Backdrop {
  private readonly layers: HTMLElement[];
  private front = 0;
  private wanted: string | null = null;
  private readonly preloaded = new Map<string, Promise<void>>();

  constructor() {
    const root = document.createElement("div");
    root.className = "backdrop";
    root.setAttribute("aria-hidden", "true");
    this.layers = [0, 1].map(() => {
      const layer = document.createElement("div");
      layer.className = "backdrop__layer";
      root.append(layer);
      return layer;
    });
    document.body.prepend(root);
  }

  /** Loads (once) and decodes an image so showing it later is instant. */
  preload(url: string | null | undefined) {
    if (!url) return Promise.resolve();
    let p = this.preloaded.get(url);
    if (!p) {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      p = img.decode().catch(() => undefined);
      this.preloaded.set(url, p);
    }
    return p;
  }

  show(game: Game) {
    const url = game.backgroundUrl ?? null;
    if (url === this.wanted) return;
    this.wanted = url;
    if (!url) return this.hide();
    void this.preload(url).then(() => {
      if (this.wanted !== url) return; // another game was selected meanwhile
      const next = 1 - this.front;
      const layer = this.layers[next];
      layer.style.backgroundImage = `url("${url}")`;
      layer.classList.toggle("is-cover", isCover(url));
      layer.classList.add("is-visible");
      this.layers[this.front].classList.remove("is-visible");
      this.front = next;
      document.body.classList.add("has-backdrop");
    });
  }

  hide() {
    this.wanted = null;
    for (const layer of this.layers) layer.classList.remove("is-visible");
    document.body.classList.remove("has-backdrop");
  }
}
