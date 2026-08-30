export type ReportPeriod = "week" | "month" | "quarter" | "all";

export type ReportTask = {
  createdAt: Date | string;
  status: string;
  completedAt?: Date | string | null;
};

export type ReportPeriodRange = { start: Date; end: Date };

export function getReportPeriodRange(period: ReportPeriod, now = new Date()): ReportPeriodRange {
  const end = new Date(now);
  if (period === "all") return { start: new Date(0), end };
  const days = period === "week" ? 7 : period === "month" ? 30 : 90;
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return { start, end };
}

function within(value: Date | string | null | undefined, range: ReportPeriodRange) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= range.start.getTime() && time <= range.end.getTime();
}

export function filterReportTasks<T extends ReportTask>(
  tasks: T[],
  period: ReportPeriod,
  now = new Date(),
) {
  const range = getReportPeriodRange(period, now);
  return {
    // Created list: date is always determined by createdAt.
    created: tasks.filter((task) => within(task.createdAt, range)),
    // Completed list: date is always determined by completedAt and status.
    completed: tasks.filter((task) => task.status === "completed" && within(task.completedAt, range)),
    range,
  };
}
