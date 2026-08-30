import { describe, expect, it } from "vitest";
import { calculateWeeklySummaryData } from "./weekly-summary-generator";

describe("weekly summary data", () => {
  it("keeps all task descriptions grouped by responsible", () => {
    const start = new Date(2026, 7, 16);
    const end = new Date(2026, 7, 23, 15);
    const data = calculateWeeklySummaryData([
      { id: 1, taskNumber: 10, description: "Concluir medição", assignedToName: "Ana", status: "completed", createdAt: new Date(2026, 7, 10), completedAt: new Date(2026, 7, 17) },
      { id: 2, taskNumber: 11, description: "Emitir relatório", assignedToName: "Ana", status: "pending", createdAt: new Date(2026, 7, 17) },
    ], "Sala A", start, end);
    expect(data.responsibles).toHaveLength(1);
    expect(data.responsibles[0].name).toBe("Ana");
    expect(data.responsibles[0].completed).toBe(1);
    expect(data.responsibles[0].pending).toBe(1);
    expect(data.responsibles[0].tasks.map((task) => task.description)).toEqual(["Concluir medição", "Emitir relatório"]);
  });

  it("groups only the completed tasks returned for the seven-day window", () => {
    const start = new Date(2026, 7, 16);
    const end = new Date(2026, 7, 23, 15);
    // The database query excludes completed tasks outside the window before
    // this generator is called.
    const data = calculateWeeklySummaryData([
      { id: 1, taskNumber: 10, description: "Concluída nesta semana", assignedToName: "Ana", status: "completed", createdAt: new Date(2026, 7, 1), completedAt: new Date(2026, 7, 17) },
    ], "Sala A", start, end);
    expect(data.completedTasks).toBe(1);
    expect(data.responsibles[0].tasks.map((task) => task.description)).toEqual(["Concluída nesta semana"]);
  });
});
