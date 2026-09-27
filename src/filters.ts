import type { Game } from "./types";

/** Header filters (ITERATION-3 §6); they apply to timeline, minimap, PagSu/PagGiù and search. */
export interface Filters {
  dlc: boolean;
  switch2Edition: boolean;
  freeUpdates: boolean;
  thirdParty: boolean;
  exclusivesOnly: boolean;
}

const DEFAULTS: Filters = { dlc: true, switch2Edition: true, freeUpdates: true, thirdParty: true, exclusivesOnly: false };
const STORAGE_KEY = "filters";

const OPTIONS: { key: keyof Filters; label: string; hint: string }[] = [
  { key: "dlc", label: "DLC", hint: "Expansions and add-ons" },
  { key: "switch2Edition", label: "Switch 2 Edition", hint: "Upgraded Switch 1 games" },
  { key: "freeUpdates", label: "Free updates", hint: "Switch 1 games with a free Switch 2 update" },
  { key: "thirdParty", label: "Third-party", hint: "Exclusives from other publishers" },
  { key: "exclusivesOnly", label: "Exclusives only", hint: "Hide games also on other consoles or PC (phones don't count)" },
];

export function loadFilters(): Filters {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<Filters>;
    return { ...DEFAULTS, ...saved };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveFilters(f: Filters) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(f));
  } catch {
    // Storage unavailable: the choice lasts for this visit only.
  }
}

export function applyFilters(games: Game[], f: Filters) {
  return games.filter(
    (g) =>
      (f.dlc || g.kind !== "dlc") &&
      (f.switch2Edition || g.kind !== "switch2-edition") &&
      (f.freeUpdates || g.kind !== "free-update") &&
      // Older data without the flag counts as first-party.
      (f.thirdParty || g.firstParty !== false) &&
      // Switch + phone games (e.g. Pokémon Champions) stay: only other consoles / PC count.
      (!f.exclusivesOnly || g.exclusivity === "exclusive" || g.onOtherConsoles === false),
  );
}

export const isDefault = (f: Filters) => OPTIONS.every(({ key }) => f[key] === DEFAULTS[key]);

/**
 * "58 games" only when no filter is on: an active filter that hides nothing
 * (e.g. "Exclusives only" when every game is exclusive) still reads "58 of 58".
 */
export function countLabel(visible: number, total: number, filtered: boolean) {
  return visible === total && !filtered ? `${total} games` : `${visible} of ${total}`;
}

/**
 * "42 of 58 games ▾" in the header: the count is always visible, the switches
 * open in a small panel (the bar has no room for four toggles at 1280px).
 */
export class FiltersControl {
  private readonly button: HTMLButtonElement;
  private readonly panel: HTMLElement;
  private filters: Filters;

  constructor(
    host: HTMLElement,
    initial: Filters,
    private readonly onChange: (f: Filters) => void,
  ) {
    this.filters = initial;
    const wrap = document.createElement("div");
    wrap.className = "filters";
    this.button = document.createElement("button");
    this.button.type = "button";
    this.button.className = "filters__toggle";
    this.button.setAttribute("aria-expanded", "false");
    this.button.setAttribute("aria-controls", "filters-panel");

    this.panel = document.createElement("div");
    this.panel.className = "filters__panel";
    this.panel.id = "filters-panel";
    this.panel.hidden = true;
    this.panel.setAttribute("role", "group");
    this.panel.setAttribute("aria-label", "Filters");
    for (const { key, label, hint } of OPTIONS) {
      const row = document.createElement("label");
      row.className = "filters__option";
      row.innerHTML = `<input type="checkbox"><span class="filters__switch" aria-hidden="true"></span><span><strong></strong><small></small></span>`;
      const input = row.querySelector("input")!;
      input.checked = this.filters[key];
      input.addEventListener("change", () => {
        this.filters = { ...this.filters, [key]: input.checked };
        saveFilters(this.filters);
        this.onChange(this.filters);
      });
      row.querySelector("strong")!.textContent = label;
      row.querySelector("small")!.textContent = hint;
      this.panel.append(row);
    }
    wrap.append(this.button, this.panel);
    host.prepend(wrap);

    this.button.addEventListener("click", () => this.setOpen(this.panel.hidden));
    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target as Node)) this.setOpen(false);
    });
    wrap.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !this.panel.hidden) {
        e.stopPropagation();
        this.setOpen(false);
        this.button.focus();
      }
    });
  }

  private setOpen(open: boolean) {
    this.panel.hidden = !open;
    this.button.setAttribute("aria-expanded", String(open));
  }

  /** "42 of 58" (games and free updates); a dot marks non-default filters. */
  setCount(visible: number, total: number) {
    this.button.innerHTML = `<span class="filters__count"></span><span class="filters__caret" aria-hidden="true">▾</span>`;
    const filtered = !isDefault(this.filters);
    this.button.querySelector(".filters__count")!.textContent = countLabel(visible, total, filtered);
    this.button.classList.toggle("is-filtered", filtered);
    this.button.setAttribute("aria-label", `Filters: showing ${visible} of ${total}`);
  }
}
