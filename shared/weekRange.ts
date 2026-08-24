export type WeekRange = { start: Date; end: Date };

/** Returns the previous Sunday 00:00 through the request moment. */
export function getPreviousSundayRange(now = new Date()): WeekRange {
  const end = new Date(now);
  const start = new Date(now);
  const daysSinceSunday = now.getDay() || 7;
  start.setDate(now.getDate() - daysSinceSunday);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

export function formatWeekRange(range: WeekRange): string {
  const format = (date: Date) => date.toLocaleDateString("pt-BR");
  return `${format(range.start)} a ${format(range.end)}`;
}
