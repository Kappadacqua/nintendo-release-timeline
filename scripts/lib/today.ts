/** Today in the local time zone, "YYYY-MM-DD", as on the timeline and the Studios page. */
export const localToday = (now = new Date()) =>
  [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((n) => String(n).padStart(2, "0")).join("-");
