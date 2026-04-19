import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useI18n } from "vue-i18n";
import {
  AlertTriangle,
  Ban,
  Check,
  Clock3,
  ListTodo,
  LoaderCircle,
  type LucideIcon,
  XCircle,
} from "lucide-vue-next";
import {
  getBackgroundTaskName,
  hasSelfContainedBackgroundTaskTitle,
} from "@/helpers/backgroundTasks";
import { formatBackgroundTaskScheduleLabel } from "@/helpers/backgroundTaskSchedule";
import { type BackgroundTask, TaskStatus } from "@/plugins/api/interfaces";

export const isScheduledTask = (task: BackgroundTask) => task.schedule != null;
export const isActiveTask = (task: BackgroundTask) =>
  task.status === TaskStatus.RUNNING || task.status === TaskStatus.PENDING;
export const canRunTaskManually = (task: BackgroundTask) =>
  task.status !== TaskStatus.RUNNING && isScheduledTask(task);
export const isRetryableTask = (task: BackgroundTask) =>
  task.status === TaskStatus.FAILED ||
  task.status === TaskStatus.CANCELLED ||
  task.status === TaskStatus.PARTIAL_SUCCESS;
export const isCancelableTask = (task: BackgroundTask) =>
  task.status === TaskStatus.RUNNING || task.status === TaskStatus.PENDING;
export const canRemoveTask = (task: BackgroundTask) =>
  !isScheduledTask(task) && !isCancelableTask(task);
export const canEditTaskSchedule = (task: BackgroundTask) =>
  task.schedule != null;

export function useBackgroundTaskDisplay(
  taskRef: MaybeRefOrGetter<BackgroundTask>,
) {
  const { t, te } = useI18n();
  const task = computed(() => toValue(taskRef));

  const displayName = computed(() => getBackgroundTaskName(task.value, t, te));
  const isScheduled = computed(() => isScheduledTask(task.value));
  const isActive = computed(() => isActiveTask(task.value));
  const showProgressBar = computed(
    () => isActive.value && task.value.progress != null,
  );
  const showProgressText = computed(
    () =>
      isActive.value &&
      task.value.progress == null &&
      Boolean(task.value.progress_text),
  );
  const failureSummary = computed(() =>
    formatBackgroundTaskFailureSummary(task.value, t),
  );
  const formattedStatus = computed(() =>
    formatBackgroundTaskStatus(task.value.status, t, te),
  );
  const statusBadgeClass = computed(() =>
    getStatusBadgeClass(task.value.status),
  );
  const statusIcon = computed(() => getStatusIcon(task.value.status));
  const statusIconClass = computed(() =>
    task.value.status === TaskStatus.RUNNING ? "size-5 animate-spin" : "size-5",
  );
  const statusIndicatorClass = computed(() =>
    getStatusIndicatorClass(task.value.status),
  );
  const taskSummary = computed(() => getTaskSummary(task.value, t));

  return {
    displayName,
    failureSummary,
    formattedStatus,
    isActive,
    isScheduled,
    showProgressBar,
    showProgressText,
    statusBadgeClass,
    statusIcon,
    statusIconClass,
    statusIndicatorClass,
    taskSummary,
  };
}

const getStatusIcon = (status: TaskStatus): LucideIcon => {
  switch (status) {
    case TaskStatus.RUNNING:
      return LoaderCircle;
    case TaskStatus.PENDING:
      return Clock3;
    case TaskStatus.SUCCESS:
      return Check;
    case TaskStatus.PARTIAL_SUCCESS:
      return AlertTriangle;
    case TaskStatus.FAILED:
      return XCircle;
    case TaskStatus.CANCELLED:
      return Ban;
    default:
      return ListTodo;
  }
};

const getStatusBadgeClass = (status: TaskStatus) => {
  switch (status) {
    case TaskStatus.RUNNING:
      return "border-blue-300 bg-blue-500/10 text-blue-700 dark:border-blue-800 dark:bg-blue-500/10 dark:text-blue-300";
    case TaskStatus.PENDING:
      return "border-amber-300 bg-amber-500/10 text-amber-700 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-300";
    case TaskStatus.SUCCESS:
      return "border-emerald-300 bg-emerald-500/10 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300";
    case TaskStatus.PARTIAL_SUCCESS:
      return "border-amber-300 bg-amber-500/10 text-amber-700 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-300";
    case TaskStatus.FAILED:
      return "border-red-300 bg-red-500/10 text-red-700 dark:border-red-800 dark:bg-red-500/10 dark:text-red-300";
    case TaskStatus.CANCELLED:
      return "border-slate-300 bg-slate-500/10 text-slate-700 dark:border-slate-700 dark:bg-slate-500/10 dark:text-slate-300";
    default:
      return "border-muted-foreground/20 bg-muted text-muted-foreground";
  }
};

const getStatusIndicatorClass = (status: TaskStatus) => {
  const baseClass =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border";
  switch (status) {
    case TaskStatus.RUNNING:
      return `${baseClass} border-blue-300 bg-blue-500/10 text-blue-700 dark:border-blue-800 dark:bg-blue-500/10 dark:text-blue-300`;
    case TaskStatus.PENDING:
      return `${baseClass} border-amber-300 bg-amber-500/10 text-amber-700 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-300`;
    case TaskStatus.SUCCESS:
      return `${baseClass} border-emerald-300 bg-emerald-500/10 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300`;
    case TaskStatus.PARTIAL_SUCCESS:
      return `${baseClass} border-amber-300 bg-amber-500/10 text-amber-700 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-300`;
    case TaskStatus.FAILED:
      return `${baseClass} border-red-300 bg-red-500/10 text-red-700 dark:border-red-800 dark:bg-red-500/10 dark:text-red-300`;
    case TaskStatus.CANCELLED:
      return `${baseClass} border-slate-300 bg-slate-500/10 text-slate-700 dark:border-slate-700 dark:bg-slate-500/10 dark:text-slate-300`;
    default:
      return `${baseClass} border-muted bg-muted/60 text-muted-foreground`;
  }
};

export const formatBackgroundTaskStatus = (
  status: TaskStatus,
  t: (key: string) => string,
  te: (key: string) => boolean,
) => {
  const translationKey = `background_tasks.status.${status}`;
  if (te(translationKey)) {
    return t(translationKey);
  }
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const formatBackgroundTaskDate = (
  value: string | undefined,
  t: (key: string) => string,
) => {
  if (!value) return t("background_tasks.schedule.never");
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

export const formatBackgroundTaskSchedule = (
  schedule: BackgroundTask["schedule"] | undefined,
  t: (key: string, args?: unknown[]) => string,
) => {
  if (!schedule) return "";
  return formatBackgroundTaskScheduleLabel(schedule, t);
};

export const formatBackgroundTaskFailureSummary = (
  task: BackgroundTask,
  t: (key: string, args?: unknown[]) => string,
) => {
  if (!task.failure_count) return "";
  if (task.failure_count === 1 && task.failure_messages.length) {
    return task.failure_messages[0];
  }
  const issueLabel =
    task.failure_count === 1
      ? t("background_tasks.failure.issue")
      : t("background_tasks.failure.issues");
  if (task.failure_messages.length) {
    return t("background_tasks.failure.summary_with_message", [
      task.failure_count,
      issueLabel,
      task.failure_messages[0],
    ]);
  }
  return t("background_tasks.failure.summary", [
    task.failure_count,
    issueLabel,
  ]);
};

const getTaskSummary = (
  task: BackgroundTask,
  t: (key: string, args?: unknown[]) => string,
) => {
  const parts: string[] = [];
  const providerName = String(task.metadata.provider_name || "");
  const mediaType = String(task.metadata.media_type || "");

  if (providerName && !hasSelfContainedBackgroundTaskTitle(task)) {
    parts.push(mediaType ? `${providerName} ${mediaType}` : providerName);
  }

  const schedule = formatBackgroundTaskSchedule(task.schedule, t);
  if (schedule) {
    parts.push(schedule);
  }
  if (task.last_run) {
    parts.push(
      t("background_tasks.schedule.last_run", [
        formatBackgroundTaskDate(task.last_run, t),
      ]),
    );
  }
  if (task.next_run) {
    parts.push(
      t("background_tasks.schedule.next_run", [
        formatBackgroundTaskDate(task.next_run, t),
      ]),
    );
  }

  return parts.join(" • ");
};
