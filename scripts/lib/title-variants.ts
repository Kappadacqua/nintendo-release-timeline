/**
 * Shorter titles to try when the full one finds nothing on Metacritic, OpenCritic or
 * Wikipedia, in this order (each step applies to the previous result):
 *   1. the full title
 *   2. without "[-:–] Nintendo Switch 2 Edition…"
 *   3. without "+ …" (bundles with a DLC, e.g. "+ Star-Crossed World")
 *   4. without "- Definitive Edition"
 * A score found with a shorter title belongs to the base game: it is marked `inheritedFrom`.
 */
const STEPS = [
  /\s*[-:–—]?\s*Nintendo Switch 2 Edition.*$/i,
  /\s*\+.*$/,
  /\s*[-:–—]\s*Definitive Edition\s*$/i,
];

export function titleVariants(title: string): string[] {
  const out = [title.trim()];
  let current = out[0];
  for (const step of STEPS) {
    const next = current.replace(step, "").trim();
    if (next && next !== current) {
      out.push(next);
      current = next;
    }
  }
  return out;
}

/** Only the shorter titles (the base game's), without the full one. */
export const reducedTitles = (title: string) => titleVariants(title).slice(1);
