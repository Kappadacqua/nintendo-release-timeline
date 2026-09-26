// Calendar days as integer "epoch days" (days since 1970-01-01), computed in UTC
// so arithmetic is never shifted by DST.

const MS_PER_DAY = 86_400_000;

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "YYYY-MM-DD" → epoch day. */
export function parseDay(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

/** Today in the user's local time zone, as an epoch day. */
export function todayEpochDay(): number {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / MS_PER_DAY;
}

/** Epoch day → Date whose UTC fields hold the calendar date. */
export function dayToDate(day: number): Date {
  return new Date(day * MS_PER_DAY);
}
