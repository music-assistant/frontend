import { describe, expect, it } from "vitest";
import {
  formatAverage,
  formatCount,
  formatHour,
  weekdayNames,
} from "./statistics_format";

describe("formatCount", () => {
  it("groups thousands the locale's way", () => {
    expect(formatCount(1234, "en-GB")).toBe("1,234");
    expect(formatCount(1234, "de-DE")).toBe("1.234");
  });
});

describe("formatAverage", () => {
  it("keeps at most one decimal", () => {
    expect(formatAverage(4.25, "en-GB")).toBe("4.3");
    expect(formatAverage(4, "en-GB")).toBe("4");
    expect(formatAverage(0.04, "en-GB")).toBe("0");
  });
});

describe("formatHour", () => {
  it("formats an hour as a clock time", () => {
    expect(formatHour(21, "en-GB")).toBe("21:00");
    expect(formatHour(0, "en-GB")).toBe("00:00");
    expect(formatHour(21, "en-US")).toBe("09:00 PM");
  });
});

describe("weekdayNames", () => {
  it("starts on Monday", () => {
    expect(weekdayNames("en-GB")).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
    expect(weekdayNames("en-GB", "long")[6]).toBe("Sunday");
  });
});
