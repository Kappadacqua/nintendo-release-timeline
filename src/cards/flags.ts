import type { Region } from "../types";

// Tiny inline flags (18×12). Emoji flags don't render on every desktop OS.

function svg(body: string) {
  return `<svg class="flag" viewBox="0 0 18 12" width="18" height="12" aria-hidden="true">${body}<rect x=".5" y=".5" width="17" height="11" rx="1.5" fill="none" stroke="currentColor"/></svg>`;
}

const jp = svg(`<rect width="18" height="12" rx="1.5" fill="#fff"/><circle cx="9" cy="6" r="3.4" fill="#bc002d"/>`);

const eu = svg(
  `<rect width="18" height="12" rx="1.5" fill="#039"/>` +
    Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return `<circle cx="${(9 + Math.cos(a) * 3.6).toFixed(2)}" cy="${(6 + Math.sin(a) * 3.6).toFixed(2)}" r="0.6" fill="#fc0"/>`;
    }).join(""),
);

const na = svg(
  `<rect width="18" height="12" rx="1.5" fill="#fff"/>` +
    Array.from({ length: 7 }, (_, i) => `<rect y="${(i * 2 * 12) / 13}" width="18" height="${12 / 13}" fill="#b22234"/>`).join("") +
    `<rect width="7.6" height="${(7 * 12) / 13}" fill="#3c3b6e"/>`,
);

export const FLAGS: Record<Region, string> = { JP: jp, EU: eu, NA: na };
