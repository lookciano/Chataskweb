import { describe, expect, it } from "vitest";
import { getPreviousSundayRange } from "./weekRange";

describe("weekly report range", () => {
  it("starts at the previous Sunday and ends at the request time", () => {
    const now = new Date(2026, 7, 23, 15, 30, 0);
    const range = getPreviousSundayRange(now);
    expect(range.start).toEqual(new Date(2026, 7, 16, 0, 0, 0));
    expect(range.end).toEqual(now);
  });
});
