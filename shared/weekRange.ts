export type WeekRange = { start: Date; end: Date };

/** Returns the rolling seven-day calendar window ending at the request moment. */
export function getPreviousSundayRange(now = new Date()): WeekRange {
  const end = new Date(now);
  const start = new Date(now);
  start.setDate(start.getDate() - 7);
  return { start, end };
}

/** Alias that makes the report semantics explicit at call sites. */
export const getLastSevenDaysRange = getPreviousSundayRange;

export function formatWeekRange(range: WeekRange): string {
  const format = (date: Date) => date.toLocaleDateString("pt-BR");
  return `${format(range.start)} a ${format(range.end)}`;
}
