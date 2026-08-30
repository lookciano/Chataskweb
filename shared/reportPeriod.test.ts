import { describe, expect, it } from "vitest";
import { filterReportTasks, getReportPeriodRange } from "./reportPeriod";

describe("report period filtering", () => {
  it("uses createdAt for created tasks and completedAt for completed tasks", () => {
    const now = new Date(2026, 7, 30, 12);
    const tasks = [
      {
        id: 1,
        status: "completed",
        createdAt: new Date(2026, 6, 1),
        completedAt: new Date(2026, 7, 29),
      },
      {
        id: 2,
        status: "pending",
        createdAt: new Date(2026, 7, 29),
        completedAt: null,
      },
      {
        id: 3,
        status: "completed",
        createdAt: new Date(2026, 7, 29),
        completedAt: new Date(2026, 6, 1),
      },
    ];

    const filtered = filterReportTasks(tasks, "week", now);
    expect(filtered.created.map((task) => task.id)).toEqual([2, 3]);
    expect(filtered.completed.map((task) => task.id)).toEqual([1]);
  });

  it("returns the selected period as one shared range", () => {
    const now = new Date(2026, 7, 30, 12);
    const range = getReportPeriodRange("month", now);
    expect(range.end).toEqual(now);
    expect(range.start).toEqual(new Date(2026, 6, 31, 12));
  });
});

export {};
