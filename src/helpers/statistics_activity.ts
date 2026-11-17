import type { StatisticsHeatmapPoint } from "@/plugins/api/interfaces";

export const HOURS_PER_DAY = 24;
export const DAYS_PER_WEEK = 7;
/** The hours the "when you listen" card groups together. */
export const LISTENING_WINDOW_HOURS = 3;

/** The time of day a listening window falls in. */
export type ListenerProfile =
  "early_bird" | "afternoon" | "evening" | "night_owl";

/** The hours of the day with the most plays. */
export interface ListeningWindow {
  // first hour of the window, 0-23
  startHour: number;
  // hour the window ends at, 0-23, wrapping past midnight
  endHour: number;
  plays: number;
  // 0-100, of all plays in the period
  share: number;
  profile: ListenerProfile;
}

// the first hour of each part of the day, in order
const PROFILE_START_HOURS: [number, ListenerProfile][] = [
  [5, "early_bird"],
  [12, "afternoon"],
  [17, "evening"],
  [21, "night_owl"],
];

const isValidCell = (point: StatisticsHeatmapPoint): boolean =>
  Number.isInteger(point.weekday) &&
  point.weekday >= 0 &&
  point.weekday < DAYS_PER_WEEK &&
  Number.isInteger(point.hour) &&
  point.hour >= 0 &&
  point.hour < HOURS_PER_DAY;

/** Plays per weekday (rows, Monday first) and hour (columns). */
export function activityGrid(points: StatisticsHeatmapPoint[]): number[][] {
  const grid = Array.from({ length: DAYS_PER_WEEK }, () =>
    Array<number>(HOURS_PER_DAY).fill(0),
  );
  for (const point of points) {
    if (isValidCell(point)) grid[point.weekday][point.hour] += point.value;
  }
  return grid;
}

/** Plays per hour of the day, over all weekdays. */
export function hourlyTotals(points: StatisticsHeatmapPoint[]): number[] {
  const totals = Array<number>(HOURS_PER_DAY).fill(0);
  for (const point of points) {
    if (isValidCell(point)) totals[point.hour] += point.value;
  }
  return totals;
}

/** The part of the day an hour belongs to. */
export function listenerProfile(hour: number): ListenerProfile {
  let profile: ListenerProfile = "night_owl";
  for (const [startHour, candidate] of PROFILE_START_HOURS) {
    if (hour >= startHour) profile = candidate;
  }
  return profile;
}

/**
 * The run of `windowHours` consecutive hours (wrapping past midnight) with
 * the most plays, or undefined when nothing was played. The earliest window
 * wins a tie. Its profile follows the window's middle hour.
 */
export function peakListeningWindow(
  hourly: number[],
  windowHours = LISTENING_WINDOW_HOURS,
): ListeningWindow | undefined {
  const total = hourly.reduce((sum, plays) => sum + plays, 0);
  if (total <= 0 || hourly.length === 0) return undefined;
  const size = Math.min(Math.max(1, windowHours), hourly.length);

  let bestStart = 0;
  let bestPlays = -1;
  for (let start = 0; start < hourly.length; start++) {
    let plays = 0;
    for (let offset = 0; offset < size; offset++) {
      plays += hourly[(start + offset) % hourly.length];
    }
    if (plays > bestPlays) {
      bestPlays = plays;
      bestStart = start;
    }
  }

  const middleHour = (bestStart + Math.floor(size / 2)) % hourly.length;
  return {
    startHour: bestStart,
    endHour: (bestStart + size) % hourly.length,
    plays: bestPlays,
    share: Math.round((bestPlays / total) * 100),
    profile: listenerProfile(middleHour),
  };
}

/** Whether an hour lies inside a window, which may wrap past midnight. */
export function isHourInWindow(hour: number, window: ListeningWindow): boolean {
  if (window.startHour < window.endHour) {
    return hour >= window.startHour && hour < window.endHour;
  }
  return hour >= window.startHour || hour < window.endHour;
}
