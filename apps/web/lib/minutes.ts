/** Whole minutes from `iso` until `now` (never negative). */
export function minutesSince(iso: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / 60_000));
}

/** "seit 8 Min." / "gerade eben": how long something has been going on, short enough for a badge line. */
export function sinceLabel(iso: string, now: Date): string {
  const minutes = minutesSince(iso, now);
  return minutes < 1 ? "gerade eben" : `seit ${minutes} Min.`;
}
