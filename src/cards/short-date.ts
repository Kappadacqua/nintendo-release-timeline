import { MONTHS } from "../timeline/dates";

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, base: `${MONTHS[m - 1].slice(0, 3)} ${d}` };
}

/** "May 28" in `refYear`, "May 28 ’26" in any other year: three of them must fit one card row. */
export function shortDate(iso: string, refYear: number) {
  const { y, base } = parts(iso);
  return y === refYear ? base : `${base} ’${String(y).slice(-2)}`;
}

/** "May 28, 2026": the full date, where there is room (labels, the free update's single date). */
export function fullYearDate(iso: string) {
  const { y, base } = parts(iso);
  return `${base}, ${y}`;
}
