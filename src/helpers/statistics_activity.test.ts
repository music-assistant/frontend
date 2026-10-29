import { describe, expect, it } from "vitest";
import {
  activityGrid,
  hourlyTotals,
  isHourInWindow,
  listenerProfile,
  peakListeningWindow,
} from "./statistics_activity";

const hours = (values: Record<number, number>): number[] =>
  Array.from({ length: 24 }, (_, hour) => values[hour] ?? 0);

describe("activityGrid", () => {
  it("places plays by weekday and hour and sums repeated cells", () => {
    const grid = activityGrid([
      { weekday: 0, hour: 9, value: 2 },
      { weekday: 0, hour: 9, value: 1 },
      { weekday: 6, hour: 23, value: 4 },
    ]);

    expect(grid).toHaveLength(7);
    expect(grid.every((row) => row.length === 24)).toBe(true);
    expect(grid[0][9]).toBe(3);
    expect(grid[6][23]).toBe(4);
  });

  it("ignores cells outside the week or the day", () => {
    const grid = activityGrid([
      { weekday: 7, hour: 1, value: 5 },
      { weekday: -1, hour: 1, value: 5 },
      { weekday: 1, hour: 24, value: 5 },
      { weekday: 1.5, hour: 2, value: 5 },
    ]);

    expect(grid.flat().every((value) => value === 0)).toBe(true);
  });
});

describe("hourlyTotals", () => {
  it("sums each hour over the weekdays", () => {
    const totals = hourlyTotals([
      { weekday: 0, hour: 22, value: 2 },
      { weekday: 4, hour: 22, value: 3 },
      { weekday: 4, hour: 8, value: 1 },
      { weekday: 9, hour: 8, value: 9 },
    ]);

    expect(totals).toHaveLength(24);
    expect(totals[22]).toBe(5);
    expect(totals[8]).toBe(1);
  });
});

describe("listenerProfile", () => {
  it.each([
    [0, "night_owl"],
    [4, "night_owl"],
    [5, "early_bird"],
    [11, "early_bird"],
    [12, "afternoon"],
    [16, "afternoon"],
    [17, "evening"],
    [20, "evening"],
    [21, "night_owl"],
    [23, "night_owl"],
  ] as const)("puts %i:00 in %s", (hour, profile) => {
    expect(listenerProfile(hour)).toBe(profile);
  });
});

describe("peakListeningWindow", () => {
  it("is undefined when nothing was played", () => {
    expect(peakListeningWindow(hours({}))).toBeUndefined();
    expect(peakListeningWindow([])).toBeUndefined();
  });

  it("finds the busiest three hours and their share", () => {
    const window = peakListeningWindow(hours({ 8: 1, 14: 3, 15: 4, 16: 2 }));

    expect(window).toEqual({
      startHour: 14,
      endHour: 17,
      plays: 9,
      share: 90,
      profile: "afternoon",
    });
  });

  it("wraps past midnight", () => {
    const window = peakListeningWindow(hours({ 23: 4, 0: 4, 1: 4, 10: 2 }));

    expect(window?.startHour).toBe(23);
    expect(window?.endHour).toBe(2);
    expect(window?.profile).toBe("night_owl");
    expect(window?.share).toBe(86);
  });

  it("prefers the earliest window on a tie", () => {
    expect(peakListeningWindow(hours({ 6: 1, 18: 1 }))?.startHour).toBe(4);
  });

  it("supports other window sizes", () => {
    const window = peakListeningWindow(hours({ 7: 1, 19: 3 }), 1);

    expect(window).toMatchObject({
      startHour: 19,
      endHour: 20,
      share: 75,
      profile: "evening",
    });
  });
});

describe("isHourInWindow", () => {
  const window = peakListeningWindow(hours({ 23: 4, 0: 4, 1: 4 }))!;

  it("includes the hours of a window that wraps past midnight", () => {
    expect(
      [22, 23, 0, 1, 2].map((hour) => isHourInWindow(hour, window)),
    ).toEqual([false, true, true, true, false]);
  });

  it("includes the hours of a window within the day", () => {
    const daytime = peakListeningWindow(hours({ 14: 3 }))!;

    expect(
      [11, 12, 13, 14, 15].map((hour) => isHourInWindow(hour, daytime)),
    ).toEqual([false, true, true, true, false]);
  });
});
