import { describe, expect, it } from "vitest";
import { formatDateOnly, parseDateOnly } from "./dateOnly";

describe("date-only helpers", () => {
  it("preserves the calendar day from an HTML date input", () => {
    const value = parseDateOnly("2026-07-22");
    expect(value).not.toBeNull();
    expect(formatDateOnly(value)).toBe("2026-07-22");
  });

  it("rejects invalid calendar dates", () => {
    expect(parseDateOnly("2026-02-30")).toBeNull();
    expect(parseDateOnly("22/07/2026")).toBeNull();
  });
});
