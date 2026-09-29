import "./styles/main.css";
import { applyFilters, FiltersControl, loadFilters } from "./filters";
import { loadGames } from "./games";
import { news } from "./news";
import { Search } from "./search";
import { Presentation } from "./presentation";
import { SeasonalBackground } from "./seasons/background";
import { initTheme } from "./theme/theme";
import { Timeline } from "./timeline/timeline";
import { ZOOM_LEVELS, type ZoomLevel } from "./timeline/zoom";
import type { ChangesFile, Game } from "./types";
import { loadView, ViewMenu } from "./view";
import { WhatsNew } from "./whats-new";
import { ZoomControl, zoomTransition } from "./zoom-control";

initTheme(document.querySelector<HTMLButtonElement>(".theme-toggle")!);

// Keyboard shortcuts dialog: "?" button or key.
const shortcuts = document.querySelector<HTMLDialogElement>(".shortcuts")!;
const toggleShortcuts = () => (shortcuts.open ? shortcuts.close() : shortcuts.showModal());
document.querySelector(".shortcuts-toggle")!.addEventListener("click", toggleShortcuts);
/** Global keys that are not timeline navigation: "?" (shortcuts) and "/" (search). */
let openSearch = () => {};
let togglePresentation = () => {};
window.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target instanceof HTMLElement ? e.target : null;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.closest("dialog"))) return;
  if (e.key === "?") toggleShortcuts();
  else if (e.key === "/") openSearch();
  else if (e.key === "p" || e.key === "P") togglePresentation();
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
    let view = loadView();
    // The page always opens at the Day level.
    let zoom: ZoomLevel = "day";
    const create = (games: Game[]) =>
      new Timeline(app, games, document.querySelector<HTMLElement>("#timeline-date")!, document.querySelector<HTMLElement>(".app-title")!, {
        compact: view.cardStyle === "compact",
        group: view.groupSameDay,
        zoom,
        onZoom: (level, selectId) => zoomTo(level, selectId),
      });
    let timeline = create(applyFilters(allGames, filters));

    // Zoom levels (ITERATION-4 §6): the timeline is rebuilt at the new scale, centered on
    // the same day, with an animated transition; a game picked while zoomed out opens at Day.
    const zoomTo = (level: ZoomLevel, selectId?: string) => {
      if (level === zoom && !selectId) return;
      const zoomingIn = ZOOM_LEVELS.indexOf(level) < ZOOM_LEVELS.indexOf(zoom);
      const state = timeline.getState();
      const previous = timeline;
      zoom = level;
      timeline = create(applyFilters(allGames, filters));
      zoomTransition(previous, timeline, zoomingIn);
      // Zoomed out nothing stays selected (cards are covers only).
      timeline.restoreState({ ...state, selectedId: level === "day" ? (selectId ?? state.selectedId) : null });
      zoomControl.set(level);
    };
    const zoomControl = new ZoomControl(app, zoom, (level) => zoomTo(level));

    // Filters and grouping change the layout (lanes, collisions), so the timeline is rebuilt,
    // keeping the view and, if still visible, the selected game.
    const rebuild = () => {
      const state = timeline.getState();
      timeline.destroy();
      const visible = applyFilters(allGames, filters);
      timeline = create(visible);
      timeline.restoreState(state);
      control.setCount(visible.length, allGames.length);
    };
    const control = new FiltersControl(document.querySelector<HTMLElement>(".app-header__actions")!, filters, (next) => {
      filters = next;
      rebuild();
    });
    control.setCount(applyFilters(allGames, filters).length, allGames.length);

    // Presentation (ITERATION-4 §9): always at the Day level.
    const presentation = new Presentation(() => timeline);
    const startPresentation = () => {
      if (zoom !== "day") zoomTo("day");
      presentation.start();
    };
    togglePresentation = () => (presentation.isActive ? presentation.stop() : startPresentation());

    // Seasonal background (SPEC §15): follows whichever timeline is current, in every zoom level.
    const seasons = new SeasonalBackground(() => {
      const state = timeline.getState();
      return { day: state.day ?? null, selected: state.selectedId !== null };
    }, view.seasonalBackground);

    new ViewMenu(
      document.querySelector<HTMLElement>(".app-header__actions")!,
      view,
      (next, changed) => {
        view = next;
        if (changed === "cardStyle") timeline.setCompact(view.cardStyle === "compact");
        if (changed === "groupSameDay") rebuild();
        if (changed === "seasonalBackground") seasons.setEnabled(view.seasonalBackground);
      },
      [{ label: "Start presentation", key: "P", run: startPresentation }],
    );

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
