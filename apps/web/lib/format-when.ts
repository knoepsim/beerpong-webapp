const DAY_MS = 24 * 60 * 60 * 1000;
const TIME = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });
const DATE = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "numeric" });
const DATE_WITH_YEAR = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "numeric", year: "numeric" });

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/**
 * A point in time the way people say it: "heute, 20:00 Uhr", "morgen, 20:00 Uhr", "Do., 15.10., 20:00 Uhr".
 * The year only shows up when it is not the current one.
 */
export function formatWhen(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const days = Math.round((startOfDay(date) - startOfDay(now)) / DAY_MS);
  let day: string;
  if (days === 0) day = "heute";
  else if (days === 1) day = "morgen";
  else day = (date.getFullYear() === now.getFullYear() ? DATE : DATE_WITH_YEAR).format(date);
  return `${day}, ${TIME.format(date)} Uhr`;
}
