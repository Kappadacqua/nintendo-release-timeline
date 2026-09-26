import type { Game } from "../types";

/**
 * Top-left title: the site name, or (while a card is selected) the game's cover
 * thumbnail and title, cross-faded in CSS. The <h1> keeps the site name for
 * screen readers; the game layer is decorative (the focused card announces itself).
 */
export class SiteTitle {
  private readonly cover: HTMLImageElement;
  private readonly name: HTMLElement;
  private readonly layer: HTMLElement;

  constructor(private readonly h1: HTMLElement) {
    const game = document.createElement("span");
    game.className = "app-title__game";
    game.setAttribute("aria-hidden", "true");
    this.cover = document.createElement("img");
    this.cover.alt = "";
    this.name = document.createElement("span");
    this.name.className = "app-title__game-name";
    game.append(this.cover, this.name);
    h1.append(game);
    this.layer = game;
  }

  show(game: Game) {
    this.cover.src = game.coverUrl;
    this.name.textContent = game.title;
    this.h1.classList.add("is-game");
  }

  clear() {
    this.h1.classList.remove("is-game");
  }

  destroy() {
    this.clear();
    this.layer.remove();
  }
}
