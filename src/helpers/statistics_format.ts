import { DAYS_PER_WEEK } from "./statistics_activity";

// any Monday, so the weekday names start the week the way the server does
const REFERENCE_MONDAY = Date.UTC(2024, 0, 1);
const MS_PER_DAY = 86_400_000;
const MAX_AVERAGE_FRACTION_DIGITS = 1;

/** A count for display, grouped the locale's way. */
export function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

/** An average with at most one decimal, so 4.25 reads as 4.3 and 4 as 4. */
export function formatAverage(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: MAX_AVERAGE_FRACTION_DIGITS,
  }).format(value);
}

/** An hour of the day (0-23) as a clock time, such as 21:00 or 9 PM. */
export function formatHour(hour: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2024, 0, 1, hour)));
}

/** Weekday names, Monday first, in the given style. */
export function weekdayNames(
  locale: string,
  style: "short" | "long" = "short",
): string[] {
  const formatter = new Intl.DateTimeFormat(locale, {
    weekday: style,
    timeZone: "UTC",
  });
  return Array.from({ length: DAYS_PER_WEEK }, (_, weekday) =>
    formatter.format(new Date(REFERENCE_MONDAY + weekday * MS_PER_DAY)),
  );
}
