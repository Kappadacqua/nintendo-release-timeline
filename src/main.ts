import "./styles/main.css";
import { applyFilters, FiltersControl, loadFilters } from "./filters";
import { news } from "./news";
import { Search } from "./search";
import { initTheme } from "./theme/theme";
import { Timeline } from "./timeline/timeline";
import type { ChangesFile, Game, GamesFile } from "./types";
import { WhatsNew } from "./whats-new";

initTheme(document.querySelector<HTMLButtonElement>(".theme-toggle")!);

// Keyboard shortcuts dialog: "?" button or key.
const shortcuts = document.querySelector<HTMLDialogElement>(".shortcuts")!;
const toggleShortcuts = () => (shortcuts.open ? shortcuts.close() : shortcuts.showModal());
document.querySelector(".shortcuts-toggle")!.addEventListener("click", toggleShortcuts);
/** Global keys that are not timeline navigation: "?" (shortcuts) and "/" (search). */
let openSearch = () => {};
window.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target instanceof HTMLElement ? e.target : null;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.closest("dialog"))) return;
  if (e.key === "?") toggleShortcuts();
  else if (e.key === "/") openSearch();
  else return;
  e.preventDefault();
});
// Click on the backdrop closes it.
shortcuts.addEventListener("click", (e) => {
  if (e.target === shortcuts) shortcuts.close();
});

/**
 * Development only: a link to the admin panel, and a reload that keeps the view
 * whenever the admin saves (the build rewrites games.json).
 */
function devTools(current: () => Timeline) {
  const RESTORE_KEY = "timeline-restore";
  try {
    const saved = sessionStorage.getItem(RESTORE_KEY);
    if (saved) {
      sessionStorage.removeItem(RESTORE_KEY);
      current().restoreState(JSON.parse(saved));
    }
  } catch {
    // Storage unavailable: just start from today.
  }
  const link = document.createElement("a");
  link.className = "icon-button admin-link";
  link.href = "/admin";
  link.title = "Admin (development only)";
  link.setAttribute("aria-label", "Admin panel (development only)");
  link.textContent = "✎";
  document.querySelector(".app-header__actions")!.prepend(link);

  import.meta.hot?.on("games-updated", () => {
    try {
      sessionStorage.setItem(RESTORE_KEY, JSON.stringify(current().getState()));
    } catch {
      // Storage unavailable: the reload starts from today.
    }
    location.reload();
  });
}

async function loadGames(): Promise<Game[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/games.json`);
  if (!res.ok) throw new Error(`games.json: HTTP ${res.status}`);
  const data = (await res.json()) as GamesFile;
  return data.games;
}

/** What's new is optional: without changes.json the site works as before. */
async function loadChanges(): Promise<ChangesFile> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/changes.json`);
    if (res.ok) return (await res.json()) as ChangesFile;
  } catch {
    // Network error: no changes.
  }
  return { generatedAt: "", changes: [] };
}

const app = document.querySelector<HTMLElement>("#app")!;
const status = app.querySelector<HTMLElement>(".app-status")!;
Promise.all([loadGames(), loadChanges()])
  .then(([allGames, changes]) => {
    status.remove();
    const today = new Date().toISOString().slice(0, 10);
    // Before the timeline: cards and minimap dots read it when they are created.
    news.load(changes, today);
    let filters = loadFilters();
    const create = (games: Game[]) =>
      new Timeline(app, games, document.querySelector<HTMLElement>("#timeline-date")!, document.querySelector<HTMLElement>(".app-title")!);
    let timeline = create(applyFilters(allGames, filters));

    // Filters change the layout (lanes, collisions), so the timeline is rebuilt, keeping
    // the view and, if still visible, the selected game.
    const control = new FiltersControl(document.querySelector<HTMLElement>(".app-header__actions")!, filters, (next) => {
      filters = next;
      const state = timeline.getState();
      timeline.destroy();
      const visible = applyFilters(allGames, filters);
      timeline = create(visible);
      timeline.restoreState(state);
      control.setCount(visible.length, allGames.length);
    });
    control.setCount(applyFilters(allGames, filters).length, allGames.length);

    new WhatsNew(
      document.querySelector<HTMLElement>(".app-header__actions")!,
      allGames,
      today,
      (game) => applyFilters([game], filters).length > 0,
      (game) => timeline.selectById(game.id),
    );

    const search = new Search(
      () => applyFilters(allGames, filters),
      (game) => timeline.selectById(game.id),
    );
    openSearch = () => search.open();
    document.querySelector(".search-toggle")!.addEventListener("click", openSearch);

    if (import.meta.env.DEV) devTools(() => timeline);
  })
  .catch((err: unknown) => {
    status.textContent = `Couldn't load the games (${err instanceof Error ? err.message : String(err)}).`;
    status.classList.add("app-status--error");
  })
  .finally(() => app.removeAttribute("aria-busy"));
