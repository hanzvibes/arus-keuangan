export type Frequency = "weekly" | "monthly";

/** Keep the original day of the month, so Jan 31 -> Feb 28 -> Mar 31. */
export function nextOccurrence(date: string, frequency: Frequency, anchorDay: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const target = frequency === "weekly"
    ? new Date(Date.UTC(year, month - 1, day + 7))
    : new Date(Date.UTC(year, month, Math.min(anchorDay, new Date(Date.UTC(year, month + 1, 0)).getUTCDate())));
  return target.toISOString().slice(0, 10);
}
