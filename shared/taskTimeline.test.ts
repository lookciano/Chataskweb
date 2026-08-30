import { describe, expect, it } from "vitest";
import { buildReportTimeline, buildTaskTimeline, filterTimelineTasksByPeriod, getReportLists } from "./taskTimeline";

describe("task timeline", () => {
  it("does not use updatedAt as a completion date", () => {
    const points = buildTaskTimeline([
      {
        createdAt: new Date(2026, 7, 10),
        status: "completed",
        completedAt: new Date(2026, 7, 20),
        updatedAt: new Date(2026, 7, 28),
      },
    ]);
    expect(points.find((point) => point.date === "2026-08-20")?.completed).toBe(1);
    expect(points.find((point) => point.date === "2026-08-28")?.completed ?? 0).toBe(0);
  });

  it("uses one period selection for created and completed lists", () => {
    const now = new Date(2026, 7, 30, 12);
    const result = getReportLists([
      { createdAt: new Date(2026, 6, 1), status: "completed", completedAt: new Date(2026, 7, 29) },
      { createdAt: new Date(2026, 7, 29), status: "pending", completedAt: null },
    ], "week", now);
    expect(result.created).toHaveLength(1);
    expect(result.completed).toHaveLength(1);
  });

  it("builds both chart series from their own event dates", () => {
    const points = buildReportTimeline([
      { createdAt: new Date(2026, 7, 1), status: "completed", completedAt: new Date(2026, 7, 29) },
    ], "month", new Date(2026, 7, 30, 12));
    expect(points.find((point) => point.date === "2026-08-01")?.created).toBe(1);
    expect(points.find((point) => point.date === "2026-08-29")?.completed).toBe(1);
  });

  it("filters tasks by created or completed date in the selected period", () => {
    const now = new Date(2026, 7, 30, 12);
    const result = filterTimelineTasksByPeriod([
      { createdAt: new Date(2026, 7, 1), status: "completed", completedAt: new Date(2026, 7, 29) },
      { createdAt: new Date(2026, 6, 1), status: "completed", completedAt: new Date(2026, 6, 2) },
    ], "week", now);
    expect(result).toHaveLength(1);
  });
});
