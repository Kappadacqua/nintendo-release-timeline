import { type Card, cardWidth, createCard } from "../cards/card";
import type { Game } from "../types";

export const TBA_LAYOUT = {
  padding: 24,
  cardGap: 20,
  blockGap: 48,
  minWidth: 240,
};

export interface TbaCardSlot {
  game: Game;
  /** World x of the card's center. */
  x: number;
  card?: Card;
  revealed: boolean;
}

export interface TbaBlock {
  /** "2026", "2027"… or "TBA" when not even the year is known. */
  label: string;
  x: number;
  width: number;
  slots: TbaCardSlot[];
  node?: HTMLElement;
  inRange: boolean;
}

/** Groups games without a precise date by expected year and lays the blocks out from `startX`. */
export function layoutTba(games: Game[], startX: number): { blocks: TbaBlock[]; endX: number } {
  const groups = new Map<number | null, Game[]>();
  for (const game of games) {
    const year = game.vagueRelease?.year ?? null;
    groups.set(year, [...(groups.get(year) ?? []), game]);
  }
  // Known years ascending, fully unknown ("TBA") last.
  const years = [...groups.keys()].sort((a, b) => (a ?? Infinity) - (b ?? Infinity));

  const { padding, cardGap, blockGap, minWidth } = TBA_LAYOUT;
  const blocks: TbaBlock[] = [];
  let cursor = startX;
  for (const year of years) {
    const blockGames = groups.get(year)!.sort((a, b) => a.title.localeCompare(b.title));
    const cardsWidth = blockGames.reduce((sum, g) => sum + cardWidth(g), 0) + cardGap * (blockGames.length - 1);
    const width = Math.max(minWidth, cardsWidth + padding * 2);

    let cardX = cursor + (width - cardsWidth) / 2;
    const slots = blockGames.map((game) => {
      const w = cardWidth(game);
      const slot = { game, x: cardX + w / 2, revealed: false };
      cardX += w + cardGap;
      return slot;
    });

    blocks.push({ label: year === null ? "TBA" : String(year), x: cursor, width, slots, inRange: false });
    cursor += width + blockGap;
  }
  return { blocks, endX: blocks.length ? cursor - blockGap : startX };
}

export function createTbaBlockNode(block: TbaBlock, todayDay: number) {
  const root = document.createElement("section");
  root.className = "tba-block";
  root.style.left = `${block.x}px`;
  root.style.width = `${block.width}px`;
  root.setAttribute("aria-label", block.label === "TBA" ? "Release date to be announced" : `Expected in ${block.label}`);

  const head = document.createElement("header");
  head.className = "tba-block__head";
  const label = document.createElement("span");
  label.className = "tba-block__label";
  label.textContent = block.label;
  const sub = document.createElement("span");
  sub.className = "tba-block__sub";
  sub.textContent = "Date to be announced";
  head.append(label, sub);

  const row = document.createElement("div");
  row.className = "tba-block__cards";
  for (const slot of block.slots) {
    slot.card = createCard(slot.game, todayDay);
    row.append(slot.card.el);
  }

  root.append(head, row);
  return root;
}
