import Fuse from "fuse.js";
import { MONTHS } from "./timeline/dates";
import type { Game } from "./types";

const KIND_LABEL: Record<Game["kind"], string> = { game: "Game", dlc: "DLC", "switch2-edition": "Switch 2 Edition" };
const MAX_RESULTS = 8;

function when(g: Game) {
  if (g.firstReleaseDate) {
    const [y, m, d] = g.firstReleaseDate.split("-").map(Number);
    return `${MONTHS[m - 1].slice(0, 3)} ${d}, ${y}`;
  }
  return g.vagueRelease?.label ?? "TBA";
}

/**
 * Quick search (ITERATION-3 §5): "/" or the magnifier opens it; typo-tolerant on titles;
 * ↑/↓ choose, Enter jumps to the game and selects it, Esc closes. It is a modal <dialog>,
 * so the timeline shortcuts (which ignore events from dialogs) are off while it is open.
 */
export class Search {
  private readonly dialog: HTMLDialogElement;
  private readonly input: HTMLInputElement;
  private readonly list: HTMLUListElement;
  private results: Game[] = [];
  private active = 0;
  private fuse: Fuse<Game> | null = null;

  constructor(
    private readonly games: () => Game[],
    private readonly onPick: (game: Game) => void,
  ) {
    this.dialog = document.createElement("dialog");
    this.dialog.className = "search";
    this.dialog.setAttribute("aria-label", "Search games");
    this.dialog.innerHTML = `
      <div class="search__field">
        <span class="search__icon" aria-hidden="true"></span>
        <input type="search" placeholder="Search games…" autocomplete="off" spellcheck="false"
          role="combobox" aria-expanded="true" aria-controls="search-results" aria-autocomplete="list">
        <kbd>Esc</kbd>
      </div>
      <ul class="search__results" id="search-results" role="listbox" aria-label="Results"></ul>`;
    this.input = this.dialog.querySelector("input")!;
    this.list = this.dialog.querySelector("ul")!;
    document.body.append(this.dialog);

    this.input.addEventListener("input", () => this.update());
    this.input.addEventListener("keydown", (e) => this.onKey(e));
    this.dialog.addEventListener("click", (e) => {
      if (e.target === this.dialog) this.close(); // backdrop
    });
  }

  open() {
    if (this.dialog.open) return;
    // Built on open: always searches the games the current filters show.
    this.fuse = new Fuse(this.games(), {
      keys: [
        { name: "title", weight: 3 },
        { name: "baseGameTitle", weight: 1 },
      ],
      threshold: 0.38,
      ignoreLocation: true,
    });
    this.input.value = "";
    this.update();
    this.dialog.showModal();
    this.input.focus();
  }

  close() {
    this.dialog.close();
  }

  private update() {
    const q = this.input.value.trim();
    this.results = q && this.fuse ? this.fuse.search(q, { limit: MAX_RESULTS }).map((r) => r.item) : [];
    this.active = 0;
    this.render(q);
  }

  private render(q: string) {
    if (!this.results.length) {
      const empty = document.createElement("li");
      empty.className = "search__empty";
      empty.textContent = q ? "No games found (filters apply to search too)." : "Type a title — small typos are fine.";
      this.list.replaceChildren(empty);
      this.input.removeAttribute("aria-activedescendant");
      return;
    }
    this.list.replaceChildren(
      ...this.results.map((g, i) => {
        const li = document.createElement("li");
        li.id = `search-result-${i}`;
        li.className = "search__result";
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", String(i === this.active));
        li.innerHTML = `<img alt="" loading="lazy"><span class="search__text"><strong></strong><small></small></span>`;
        li.querySelector("img")!.src = g.coverUrl;
        li.querySelector("strong")!.textContent = g.title;
        li.querySelector("small")!.textContent = `${KIND_LABEL[g.kind]} · ${when(g)}`;
        li.addEventListener("mousemove", () => this.setActive(i));
        li.addEventListener("click", () => this.pick(i));
        return li;
      }),
    );
    this.input.setAttribute("aria-activedescendant", `search-result-${this.active}`);
  }

  private setActive(i: number) {
    if (i === this.active) return;
    this.active = i;
    this.list.querySelectorAll("[role=option]").forEach((li, j) => li.setAttribute("aria-selected", String(j === i)));
    this.input.setAttribute("aria-activedescendant", `search-result-${i}`);
    this.list.children[i]?.scrollIntoView({ block: "nearest" });
  }

  private onKey(e: KeyboardEvent) {
    const n = this.results.length;
    if (e.key === "ArrowDown" && n) this.setActive((this.active + 1) % n);
    else if (e.key === "ArrowUp" && n) this.setActive((this.active - 1 + n) % n);
    else if (e.key === "Enter" && n) this.pick(this.active);
    // A search input's own Esc only clears the text: close straight away instead.
    else if (e.key === "Escape") this.close();
    else return;
    e.preventDefault();
  }

  private pick(i: number) {
    const game = this.results[i];
    if (!game) return;
    this.close();
    this.onPick(game);
  }
}
