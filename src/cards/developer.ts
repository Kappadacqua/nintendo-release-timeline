/** Names that suffix-stripping would get wrong. */
const DEVELOPER_ALIASES: Record<string, string> = {
  "Nintendo Software Technology": "NST",
};
/** Internal divisions and corporate words dropped from long names. */
const DIVISION_SUFFIX = /\s+(?:Production Group|Business Division|Creative Studio|Development Division|Division|Studio)\s*(?:No\.\s*)?\d+$/i;
const CORPORATE_WORDS = new Set(["entertainment", "digital", "online", "software", "planning", "technology", "multimedia", "inc.", "ltd.", "co.,"]);
const MAX_DEVELOPER_CHARS = 20;

/** "Nintendo EPD Production Group No. 9" → "Nintendo EPD", "Konami Digital Entertainment" → "Konami". */
export function shortDeveloper(name: string) {
  if (name.length <= MAX_DEVELOPER_CHARS) return name;
  if (DEVELOPER_ALIASES[name]) return DEVELOPER_ALIASES[name];
  let words = name.replace(DIVISION_SUFFIX, "").split(/\s+/);
  while (words.length > 1 && CORPORATE_WORDS.has(words.at(-1)!.toLowerCase())) {
    words = words.slice(0, -1);
  }
  const short = words.join(" ");
  return short.length <= MAX_DEVELOPER_CHARS ? short : `${short.slice(0, MAX_DEVELOPER_CHARS - 1).trimEnd()}…`;
}
