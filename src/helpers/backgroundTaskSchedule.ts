import { type TaskSchedule, TaskScheduleType } from "@/plugins/api/interfaces";

type TranslateFn = (key: string, args?: unknown[]) => string;

const REFERENCE_HOUR = 12;

const getPythonWeekdayFromJs = (jsDay: number) => (jsDay + 6) % 7;

const getCurrentLocalReferenceMonday = () => {
  const now = new Date();
  const weekday = getPythonWeekdayFromJs(now.getDay());
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - weekday,
    REFERENCE_HOUR,
    0,
    0,
    0,
  );
};

const getCurrentUtcReferenceMonday = () => {
  const now = new Date();
  const weekday = getPythonWeekdayFromJs(now.getUTCDay());
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - weekday,
      REFERENCE_HOUR,
      0,
      0,
      0,
    ),
  );
};

const toSortedUniqueDays = (days: number[]) =>
  [...new Set(days)].sort((left, right) => left - right);

export const formatTaskScheduleClockTime = (hour?: number, minute?: number) => {
  if (hour === undefined || minute === undefined) {
    return "";
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2024, 0, 1, hour, minute, 0, 0));
};

export const getBackgroundTaskBrowserTimeZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";

const getLocalDateForPythonWeekday = (weekday: number) => {
  const monday = getCurrentLocalReferenceMonday();
  return new Date(
    monday.getFullYear(),
    monday.getMonth(),
    monday.getDate() + weekday,
    REFERENCE_HOUR,
    0,
    0,
    0,
  );
};

export const formatLocalTaskScheduleWeekday = (weekday: number) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "short",
  }).format(getLocalDateForPythonWeekday(weekday));

const getLocalCandidateFromUtc = (
  weekday: number,
  hour: number,
  minute: number,
) => {
  const monday = getCurrentUtcReferenceMonday();
  return new Date(
    Date.UTC(
      monday.getUTCFullYear(),
      monday.getUTCMonth(),
      monday.getUTCDate() + weekday,
      hour,
      minute,
      0,
      0,
    ),
  );
};

const getUtcCandidateFromLocal = (
  weekday: number,
  hour: number,
  minute: number,
) => {
  const monday = getCurrentLocalReferenceMonday();
  return new Date(
    monday.getFullYear(),
    monday.getMonth(),
    monday.getDate() + weekday,
    hour,
    minute,
    0,
    0,
  );
};

export const convertBackgroundTaskScheduleToLocal = (
  schedule: TaskSchedule,
): TaskSchedule => {
  if (schedule.type === TaskScheduleType.HOURLY) {
    return { ...schedule };
  }

  const utcHour = schedule.hour ?? 0;
  const utcMinute = schedule.minute ?? 0;
  const localSample = getLocalCandidateFromUtc(0, utcHour, utcMinute);

  if (schedule.type === TaskScheduleType.DAILY) {
    return {
      ...schedule,
      hour: localSample.getHours(),
      minute: localSample.getMinutes(),
    };
  }

  const localDays = toSortedUniqueDays(
    (schedule.days_of_week ?? []).map((weekday) =>
      getPythonWeekdayFromJs(
        getLocalCandidateFromUtc(weekday, utcHour, utcMinute).getDay(),
      ),
    ),
  );

  return {
    ...schedule,
    days_of_week: localDays,
    hour: localSample.getHours(),
    minute: localSample.getMinutes(),
  };
};

export const convertBackgroundTaskScheduleToUtc = (
  schedule: TaskSchedule,
): TaskSchedule => {
  if (schedule.type === TaskScheduleType.HOURLY) {
    return { ...schedule };
  }

  const localHour = schedule.hour ?? 0;
  const localMinute = schedule.minute ?? 0;
  const utcSample = getUtcCandidateFromLocal(0, localHour, localMinute);

  if (schedule.type === TaskScheduleType.DAILY) {
    return {
      ...schedule,
      hour: utcSample.getUTCHours(),
      minute: utcSample.getUTCMinutes(),
    };
  }

  const utcCandidates = (schedule.days_of_week ?? []).map((weekday) =>
    getUtcCandidateFromLocal(weekday, localHour, localMinute),
  );

  return {
    ...schedule,
    days_of_week: toSortedUniqueDays(
      utcCandidates.map((candidate) =>
        getPythonWeekdayFromJs(candidate.getUTCDay()),
      ),
    ),
    hour: utcCandidates[0]?.getUTCHours() ?? utcSample.getUTCHours(),
    minute: utcCandidates[0]?.getUTCMinutes() ?? utcSample.getUTCMinutes(),
  };
};

const formatLocalScheduleBase = (schedule: TaskSchedule, t: TranslateFn) => {
  if (schedule.type === TaskScheduleType.HOURLY) {
    return t("background_tasks.schedule.every_hours", [schedule.every ?? 1]);
  }

  const localSchedule = convertBackgroundTaskScheduleToLocal(schedule);
  const time = formatTaskScheduleClockTime(
    localSchedule.hour,
    localSchedule.minute,
  );
  if (!time) {
    return "";
  }

  if (schedule.type === TaskScheduleType.DAILY) {
    return (localSchedule.every ?? 1) === 1
      ? t("background_tasks.schedule.daily_at", [time])
      : t("background_tasks.schedule.every_days_at", [
          localSchedule.every ?? 1,
          time,
        ]);
  }

  const days = (localSchedule.days_of_week ?? [])
    .map(formatLocalTaskScheduleWeekday)
    .join(", ");
  return t("background_tasks.schedule.weekly_at", [days, time]);
};

export const formatBackgroundTaskScheduleLabel = (
  schedule: TaskSchedule,
  t: TranslateFn,
) => {
  const localLabel = formatLocalScheduleBase(schedule, t);
  if (!localLabel) {
    return "";
  }

  return `${localLabel}${
    schedule.enabled ? "" : t("background_tasks.schedule.disabled_suffix")
  }`;
};
