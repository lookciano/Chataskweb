import { describe, expect, it } from "vitest";
import { getPreviousSundayRange } from "./weekRange";

describe("weekly report range", () => {
  it("covers the rolling seven days ending at the request time", () => {
    const now = new Date(2026, 7, 23, 15, 30, 0);
    const range = getPreviousSundayRange(now);
    expect(range.start).toEqual(new Date(2026, 7, 16, 15, 30, 0));
    expect(range.end).toEqual(now);
  });

  it("keeps the exact request time as the upper boundary", () => {
    const now = new Date(2026, 7, 25, 9, 12, 45);
    const range = getPreviousSundayRange(now);
    expect(range.start.getTime()).toBe(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    expect(range.end).toEqual(now);
  });
});
