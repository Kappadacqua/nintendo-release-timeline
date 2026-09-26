import "./styles/main.css";
import { initTheme } from "./theme/theme";
import { Timeline } from "./timeline/timeline";
import type { Game, GamesFile } from "./types";

initTheme(document.querySelector<HTMLButtonElement>(".theme-toggle")!);

// Keyboard shortcuts dialog: "?" button or key.
const shortcuts = document.querySelector<HTMLDialogElement>(".shortcuts")!;
const toggleShortcuts = () => (shortcuts.open ? shortcuts.close() : shortcuts.showModal());
document.querySelector(".shortcuts-toggle")!.addEventListener("click", toggleShortcuts);
window.addEventListener("keydown", (e) => {
  if (e.key !== "?" || e.ctrlKey || e.metaKey || e.altKey) return;
  e.preventDefault();
  toggleShortcuts();
});
// Click on the backdrop closes it.
shortcuts.addEventListener("click", (e) => {
  if (e.target === shortcuts) shortcuts.close();
});

/**
 * Development only: a link to the admin panel, and a reload that keeps the view
 * whenever the admin saves (the build rewrites games.json).
 */
function devTools(timeline: Timeline) {
  const RESTORE_KEY = "timeline-restore";
  try {
    const saved = sessionStorage.getItem(RESTORE_KEY);
    if (saved) {
      sessionStorage.removeItem(RESTORE_KEY);
      timeline.restoreState(JSON.parse(saved));
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
      sessionStorage.setItem(RESTORE_KEY, JSON.stringify(timeline.getState()));
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

const app = document.querySelector<HTMLElement>("#app")!;
const status = app.querySelector<HTMLElement>(".app-status")!;
loadGames()
  .then((games) => {
    status.remove();
    const timeline = new Timeline(app, games, document.querySelector<HTMLElement>("#timeline-date")!, document.querySelector<HTMLElement>(".app-title")!);
    if (import.meta.env.DEV) devTools(timeline);
  })
  .catch((err: unknown) => {
    status.textContent = `Couldn't load the games (${err instanceof Error ? err.message : String(err)}).`;
    status.classList.add("app-status--error");
  })
  .finally(() => app.removeAttribute("aria-busy"));
