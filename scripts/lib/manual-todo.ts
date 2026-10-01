import type { GameGaps } from "./gaps";

/**
 * data/manual-todo.md: released games still without a reference link after the automatic
 * lookups, one empty "- <source>: " line per link to fill in by hand. Written by
 * `npm run data:validate -- --todo`; URLs already written in the file are kept.
 */

const LINE = /^- ([A-Za-z ]+): *(\S*)\s*$/;

/** URLs already filled in, by game id and source ("igdb:1|Nintendo Wiki" → url). */
export function filledUrls(markdown: string) {
  const out = new Map<string, string>();
  let id: string | null = null;
  for (const line of markdown.split("\n")) {
    const heading = /^## .*\(`([^`]+)`/.exec(line);
    if (heading) id = heading[1];
    const m = LINE.exec(line);
    if (id && m && /^https?:\/\//.test(m[2])) out.set(`${id}|${m[1]}`, m[2]);
  }
  return out;
}

export function manualTodo(games: GameGaps[], today: string, previous = ""): string {
  const filled = filledUrls(previous);
  const head = [
    "# Links to add by hand",
    "",
    `Generated on ${today} by \`npm run data:validate -- --todo\`: released games still without a Wikipedia, Nintendo Wiki or Nintendo Store link after the automatic lookups (IGDB websites, Wikidata, Wikipedia and Nintendo Wiki APIs, base game titles).`,
    "",
    "Write the URL after the colon, then copy it into the admin panel (`npm run dev` → `/admin.html`) or under `games.<id>.links` in `data/overrides.json` and run `npm run data:build`. No page at all: `\"absent\": { \"nintendoWiki\": { \"status\": \"none\", \"reason\": \"…\", \"checkedAt\": \"YYYY-MM-DD\" } }` (likewise `wikipedia`, `nintendoStore`). URLs written here are kept when the file is generated again.",
    "",
  ];
  if (!games.length) return [...head, "Nothing left to add.", ""].join("\n");
  const body = games.flatMap((g) => [
    `## ${g.title} (\`${g.id}\`, ${g.date})`,
    "",
    // "- Nintendo Wiki: " — the space after the colon is where the URL goes.
    ...g.gaps.map((x) => `- ${x.source}: ${filled.get(`${g.id}|${x.source}`) ?? ""}`),
    "",
  ]);
  return [...head, ...body].join("\n");
}
