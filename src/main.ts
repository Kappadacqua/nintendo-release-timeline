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
    new Timeline(app, games, document.querySelector<HTMLElement>("#timeline-date")!);
  })
  .catch((err: unknown) => {
    status.textContent = `Couldn't load the games (${err instanceof Error ? err.message : String(err)}).`;
    status.classList.add("app-status--error");
  })
  .finally(() => app.removeAttribute("aria-busy"));
