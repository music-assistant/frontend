import { describe, expect, it, vi } from "vitest";
import { formatTotalDuration } from "./duration";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, params: Record<string, number>) =>
    `${key} ${JSON.stringify(params)}`,
}));

describe("formatTotalDuration", () => {
  it("gives hours and minutes", () => {
    expect(formatTotalDuration(42248)).toBe(
      'duration_hours_minutes {"hours":11,"minutes":44}',
    );
  });

  it("leaves out the minutes on a whole hour", () => {
    expect(formatTotalDuration(7200)).toBe('duration_hours {"hours":2}');
  });

  it("gives only minutes under an hour", () => {
    expect(formatTotalDuration(2290)).toBe('duration_minutes {"minutes":38}');
  });

  it("rounds to the nearest minute", () => {
    expect(formatTotalDuration(3599)).toBe('duration_hours {"hours":1}');
    expect(formatTotalDuration(89)).toBe('duration_minutes {"minutes":1}');
  });

  it("never shows zero minutes for a short playing time", () => {
    expect(formatTotalDuration(10)).toBe('duration_minutes {"minutes":1}');
  });
});
