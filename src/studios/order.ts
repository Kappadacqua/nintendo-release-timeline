import { daySpan, parseDay } from "../timeline/dates";
import type { Studio } from "../types";

// Status text and order of the Studios page (SPEC §14), without DOM so it can be tested.

/** "Upcoming · in 26 days", "Out today", "Released 3 months ago" — from the date, not the build's status. */
export function relative(days: number) {
  if (days === 0) return "Out today";
  if (days === 1) return "Upcoming · tomorrow";
  if (days === -1) return "Released yesterday";
  return days > 0 ? `Upcoming · in ${daySpan(days)}` : `Released ${daySpan(-days)} ago`;
}

/** The Switch 2 game on the card: none for studios without one (the build leaves `game` null for them). */
export const shownGame = (s: Studio) => (s.hasSwitch2Game ? s.game : null);

/** Upcoming (nearest first), then released (latest first), then no game (alphabetical). */
export function sortStudios(studios: Studio[], today: number) {
  const key = (s: Studio) => {
    const game = shownGame(s);
    if (!game) return { group: 2, day: 0 };
    const day = parseDay(game.date);
    return day >= today ? { group: 0, day } : { group: 1, day: -day };
  };
  return [...studios].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    return ka.group - kb.group || ka.day - kb.day || a.name.localeCompare(b.name);
  });
}
