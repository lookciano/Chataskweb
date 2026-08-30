import { describe, expect, it, beforeEach } from "vitest";
import { consumeDailyReportLimit, resetRateLimitStateForTests } from "./_core/rateLimit";

describe("daily report limit", () => {
  beforeEach(() => resetRateLimitStateForTests());

  it("allows three reports for the same user", () => {
    expect(() => consumeDailyReportLimit(42)).not.toThrow();
    expect(() => consumeDailyReportLimit(42)).not.toThrow();
    expect(() => consumeDailyReportLimit(42)).not.toThrow();
  });

  it("blocks the fourth report for the same user", () => {
    consumeDailyReportLimit(42);
    consumeDailyReportLimit(42);
    consumeDailyReportLimit(42);
    expect(() => consumeDailyReportLimit(42)).toThrow(/3 relatórios por dia/);
  });

  it("keeps users independent", () => {
    consumeDailyReportLimit(42);
    consumeDailyReportLimit(42);
    consumeDailyReportLimit(42);
    expect(() => consumeDailyReportLimit(43)).not.toThrow();
  });
});
