/** Whole minutes from `iso` until `now` (never negative). */
export function minutesSince(iso: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / 60_000));
}

/** "seit 8 Min." / "seit 2 Std. 5 Min." / "gerade eben": how long something has been going on, in a short line. */
export function sinceLabel(iso: string, now: Date): string {
  const minutes = minutesSince(iso, now);
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `seit ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 === 0 ? `seit ${hours} Std.` : `seit ${hours} Std. ${minutes % 60} Min.`;
}
