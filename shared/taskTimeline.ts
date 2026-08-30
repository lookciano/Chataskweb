export type ReportPeriod = "week" | "month" | "quarter" | "all";

export type TimelineTask = {
  createdAt: Date | string;
  status: string;
  completedAt?: Date | string | null;
};

export type TimelinePoint = {
  date: string;
  created: number;
  completed: number;
};

/** Format an instant as a local calendar day, without UTC day shifting. */
export function localCalendarDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Build the evolution chart; updatedAt is deliberately not a completion source. */
export function buildTaskTimeline(tasks: TimelineTask[]): TimelinePoint[] {
  const timeline = new Map<string, TimelinePoint>();
  const pointFor = (date: string) => {
    let point = timeline.get(date);
    if (!point) {
      point = { date, created: 0, completed: 0 };
      timeline.set(date, point);
    }
    return point;
  };

  for (const task of tasks) {
    const createdDate = localCalendarDate(task.createdAt);
    if (createdDate) pointFor(createdDate).created += 1;

    if (task.status === "completed" && task.completedAt) {
      const completedDate = localCalendarDate(task.completedAt);
      if (completedDate) pointFor(completedDate).completed += 1;
    }
  }

  return Array.from(timeline.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function filterTimelineTasksByPeriod<T extends TimelineTask>(
  tasks: T[],
  period: "week" | "month" | "quarter" | "all",
  now = new Date(),
): T[] {
  if (period === "all") return tasks;
  const days = period === "week" ? 7 : period === "month" ? 30 : 90;
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  return tasks.filter((task) => {
    const created = new Date(task.createdAt).getTime();
    const completed = task.completedAt ? new Date(task.completedAt).getTime() : NaN;
    return (Number.isFinite(created) && created >= start.getTime() && created <= now.getTime()) ||
      (Number.isFinite(completed) && completed >= start.getTime() && completed <= now.getTime());
  });
}

/** Build one timeline from one selected period, with independent event dates. */
export function buildReportTimeline<T extends TimelineTask>(
  tasks: T[],
  period: ReportPeriod,
  now = new Date(),
): TimelinePoint[] {
  if (period === "all") return buildTaskTimeline(tasks);
  const days = period === "week" ? 7 : period === "month" ? 30 : 90;
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  const inRange = (value: Date | string | null | undefined) => {
    if (!value) return false;
    const time = new Date(value).getTime();
    return Number.isFinite(time) && time >= start.getTime() && time <= now.getTime();
  };
  const timeline = new Map<string, TimelinePoint>();
  const pointFor = (date: string) => {
    let point = timeline.get(date);
    if (!point) {
      point = { date, created: 0, completed: 0 };
      timeline.set(date, point);
    }
    return point;
  };
  for (const task of tasks) {
    if (inRange(task.createdAt)) pointFor(localCalendarDate(task.createdAt)).created += 1;
    if (task.status === "completed" && inRange(task.completedAt)) {
      pointFor(localCalendarDate(task.completedAt!)).completed += 1;
    }
  }
  return Array.from(timeline.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/** Extract the two lists represented by the same selected period. */
export function getReportLists<T extends TimelineTask>(
  tasks: T[],
  period: "week" | "month" | "quarter" | "all",
  now = new Date(),
) {
  if (period === "all") {
    return { created: tasks, completed: tasks.filter((task) => task.status === "completed") };
  }
  const days = period === "week" ? 7 : period === "month" ? 30 : 90;
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  const inRange = (value: Date | string | null | undefined) => {
    if (!value) return false;
    const time = new Date(value).getTime();
    return Number.isFinite(time) && time >= start.getTime() && time <= now.getTime();
  };
  return {
    created: tasks.filter((task) => inRange(task.createdAt)),
    completed: tasks.filter((task) => task.status === "completed" && inRange(task.completedAt)),
  };
}
