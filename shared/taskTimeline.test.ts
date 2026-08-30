import { describe, expect, it } from "vitest";
import { buildTaskTimeline, filterTimelineTasksByPeriod } from "./taskTimeline";

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

  it("filters tasks by created or completed date in the selected period", () => {
    const now = new Date(2026, 7, 30, 12);
    const result = filterTimelineTasksByPeriod([
      { createdAt: new Date(2026, 7, 1), status: "completed", completedAt: new Date(2026, 7, 29) },
      { createdAt: new Date(2026, 6, 1), status: "completed", completedAt: new Date(2026, 6, 2) },
    ], "week", now);
    expect(result).toHaveLength(1);
  });
});
