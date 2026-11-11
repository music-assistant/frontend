import { $t } from "@/plugins/i18n";

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

/**
 * A total playing time in words, rounded to the minute: "11 h 44 min",
 * "2 h" or "38 min". For the length of a whole album or playlist, where a
 * clock-style "11:44:08" reads like a time of day.
 */
export function formatTotalDuration(totalSeconds: number): string {
  const totalMinutes = Math.max(
    1,
    Math.round(totalSeconds / SECONDS_PER_MINUTE),
  );
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;
  if (!hours) return $t("duration_minutes", { minutes });
  if (!minutes) return $t("duration_hours", { hours });
  return $t("duration_hours_minutes", { hours, minutes });
}
