import { type Card, cardWidth, createCard } from "../cards/card";
import type { Game } from "../types";

export const TBA_LAYOUT = {
  padding: 24,
  cardGap: 20,
  blockGap: 48,
  minWidth: 240,
};

/** Vertical timeline (SPEC "Mobile"): blocks run down the line, their label on top, cards in a column. */
export const TBA_LAYOUT_V = {
  padding: 12,
  cardGap: 10,
  blockGap: 32,
  minWidth: 120,
  /** Length of the block's head ("2027 · Date to be announced") before its first card. */
  head: 48,
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
export function layoutTba(
  games: Game[],
  startX: number,
  widthOf: (game: Game) => number = (g) => cardWidth(g),
  vertical = false,
): { blocks: TbaBlock[]; endX: number } {
  const groups = new Map<number | null, Game[]>();
  for (const game of games) {
    const year = game.vagueRelease?.year ?? null;
    groups.set(year, [...(groups.get(year) ?? []), game]);
  }
  // Known years ascending, fully unknown ("TBA") last.
  const years = [...groups.keys()].sort((a, b) => (a ?? Infinity) - (b ?? Infinity));

  const { padding, cardGap, blockGap, minWidth } = vertical ? TBA_LAYOUT_V : TBA_LAYOUT;
  const head = vertical ? TBA_LAYOUT_V.head : 0;
  const blocks: TbaBlock[] = [];
  let cursor = startX;
  for (const year of years) {
    const blockGames = groups.get(year)!.sort((a, b) => a.title.localeCompare(b.title));
    const cardsWidth = blockGames.reduce((sum, g) => sum + widthOf(g), 0) + cardGap * (blockGames.length - 1);
    const width = Math.max(minWidth, head + cardsWidth + padding * 2);

    let cardX = cursor + head + (width - head - cardsWidth) / 2;
    const slots = blockGames.map((game) => {
      const w = widthOf(game);
      const slot = { game, x: cardX + w / 2, revealed: false };
      cardX += w + cardGap;
      return slot;
    });

    blocks.push({ label: year === null ? "TBA" : String(year), x: cursor, width, slots, inRange: false });
    cursor += width + blockGap;
  }
  return { blocks, endX: blocks.length ? cursor - blockGap : startX };
}

export function createTbaBlockNode(block: TbaBlock, todayDay: number, vertical = false) {
  const root = document.createElement("section");
  root.className = "tba-block";
  // Vertical: the block's length runs down the line and every card sits at its slot.
  root.style[vertical ? "top" : "left"] = `${block.x}px`;
  root.style[vertical ? "height" : "width"] = `${block.width}px`;
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
    if (vertical) slot.card.el.style.top = `${slot.x - block.x}px`;
    row.append(slot.card.el);
  }

  root.append(head, row);
  return root;
}
