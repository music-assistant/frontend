<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0 sm:max-w-[1120px] xl:max-w-[1280px]"
    >
      <DialogHeader class="gap-3 px-8 pt-8 pb-4 text-left">
        <DialogTitle class="truncate pr-8">
          {{
            task
              ? getBackgroundTaskName(task, t, te)
              : t("background_tasks.details_title")
          }}
        </DialogTitle>
      </DialogHeader>

      <ScrollArea class="max-h-[78vh]">
        <div class="flex flex-col gap-8 px-8 pt-5 pb-8">
          <div class="details-grid">
            <div class="detail-row">
              <div class="detail-label">
                {{ resultLabel }}
              </div>
              <div class="detail-value detail-value--stacked">
                <Badge variant="outline">
                  {{ formattedStatus }}
                </Badge>
                <span v-if="task?.last_error" class="detail-error">
                  {{ task.last_error }}
                </span>
                <span v-else-if="failureSummary" class="detail-warning">
                  {{ failureSummary }}
                </span>
              </div>
            </div>

            <div class="detail-row">
              <div class="detail-label">
                {{ t("background_tasks.schedule_label") }}
              </div>
              <div class="detail-value">
                <div class="detail-inline">
                  <span>
                    {{ scheduleLabel }}
                  </span>
                  <Button
                    v-if="task?.schedule && canEditSchedule"
                    variant="ghost-icon"
                    size="icon-sm"
                    class="detail-inline-action"
                    :title="t('background_tasks.edit_schedule')"
                    @click="emit('editSchedule')"
                  >
                    <Pencil class="size-4" />
                    <span class="sr-only">
                      {{ t("background_tasks.edit_schedule") }}
                    </span>
                  </Button>
                </div>
              </div>
            </div>

            <div class="detail-row">
              <div class="detail-label">
                {{ t("background_tasks.last_run") }}
              </div>
              <div class="detail-value">
                {{ formatDate(task?.last_run) }}
              </div>
            </div>

            <div v-if="task?.schedule" class="detail-row">
              <div class="detail-label">
                {{ t("background_tasks.next_run") }}
              </div>
              <div class="detail-value">
                {{ formatDate(task?.next_run) }}
              </div>
            </div>

            <div class="detail-row">
              <div class="detail-label">
                {{ t("background_tasks.last_run_by") }}
              </div>
              <div class="detail-value">
                <button
                  v-if="lastRunByUserId && canOpenUsers"
                  type="button"
                  class="detail-link"
                  @click="openUserSettings(lastRunByUserId)"
                >
                  {{ lastRunByLabel }}
                </button>
                <span v-else>
                  {{ lastRunByLabel }}
                </span>
              </div>
            </div>

            <div class="detail-row">
              <div class="detail-label">
                {{ t("background_tasks.created_by") }}
              </div>
              <div class="detail-value">
                <button
                  v-if="createdByUserId && canOpenUsers"
                  type="button"
                  class="detail-link"
                  @click="openUserSettings(createdByUserId)"
                >
                  {{ createdByLabel }}
                </button>
                <span v-else>
                  {{ createdByLabel }}
                </span>
              </div>
            </div>

            <div class="detail-row">
              <div class="detail-label">
                {{ t("background_tasks.created") }}
              </div>
              <div class="detail-value">
                {{ formatDate(task?.created_at) }}
              </div>
            </div>

            <div class="detail-row">
              <div class="detail-label">
                {{ t("background_tasks.started") }}
              </div>
              <div class="detail-value">
                {{ formatDate(task?.started_at) }}
              </div>
            </div>

            <div class="detail-row">
              <div class="detail-label">
                {{ t("background_tasks.finished") }}
              </div>
              <div class="detail-value">
                {{ formatDate(task?.finished_at) }}
              </div>
            </div>

            <div
              v-if="String(task?.metadata.provider_name || '')"
              class="detail-row"
            >
              <div class="detail-label">
                {{ t("background_tasks.provider") }}
              </div>
              <div class="detail-value">
                {{ String(task?.metadata.provider_name || "") }}
              </div>
            </div>

            <div
              v-if="String(task?.metadata.media_type || '')"
              class="detail-row"
            >
              <div class="detail-label">
                {{ t("background_tasks.media_type") }}
              </div>
              <div class="detail-value">
                {{ String(task?.metadata.media_type || "") }}
              </div>
            </div>
          </div>

          <Separator />

          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="section-title">
              {{ t("background_tasks.log_title") }}
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                :disabled="!task || logLoading"
                @click="emit('copy')"
              >
                <Copy class="size-4" />
                {{ t("background_tasks.copy") }}
              </Button>
              <Button
                variant="outline"
                size="sm"
                :disabled="!task || logLoading"
                @click="emit('download')"
              >
                <Download class="size-4" />
                {{ t("background_tasks.download") }}
              </Button>
            </div>
          </div>

          <pre class="log-output">{{
            logLoading
              ? t("background_tasks.loading_log")
              : logText || t("background_tasks.no_log_output")
          }}</pre>
        </div>
      </ScrollArea>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Copy, Download, Pencil } from "lucide-vue-next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  formatBackgroundTaskDate,
  formatBackgroundTaskFailureSummary,
  formatBackgroundTaskSchedule,
  formatBackgroundTaskStatus,
} from "@/composables/useBackgroundTaskDisplay";
import { getBackgroundTaskName } from "@/helpers/backgroundTasks";
import {
  type BackgroundTask,
  TaskStatus,
  UserRole,
} from "@/plugins/api/interfaces";
import router from "@/plugins/router";
import { store } from "@/plugins/store";

interface Props {
  task: BackgroundTask | null;
  logText: string;
  logLoading?: boolean;
  userLabels?: Record<string, string>;
}

const props = withDefaults(defineProps<Props>(), {
  logLoading: false,
  userLabels: () => ({}),
});

const { t, te } = useI18n();

const open = defineModel<boolean>("open", { required: true });

const emit = defineEmits<{
  copy: [];
  download: [];
  editSchedule: [];
}>();

const formattedStatus = computed(() =>
  props.task
    ? formatBackgroundTaskStatus(props.task.status, t, te)
    : t("background_tasks.status.unknown"),
);

const resultLabel = computed(() =>
  props.task?.schedule
    ? t("background_tasks.last_result")
    : t("background_tasks.result"),
);

const failureSummary = computed(() =>
  props.task ? formatBackgroundTaskFailureSummary(props.task, t) : "",
);

const scheduleLabel = computed(() => {
  if (!props.task) {
    return t("background_tasks.no_value");
  }
  return (
    formatBackgroundTaskSchedule(props.task.schedule, t) ||
    t("background_tasks.on_demand")
  );
});

const canOpenUsers = computed(() => store.currentUser?.role === UserRole.ADMIN);
const canEditSchedule = computed(
  () => store.currentUser?.role === UserRole.ADMIN,
);

const resolveUserLabel = (userId: string | undefined, automatic = false) => {
  if (!userId) {
    return automatic
      ? t("background_tasks.automatic_schedule")
      : t("background_tasks.system");
  }
  if (props.userLabels[userId]) {
    return props.userLabels[userId];
  }
  if (store.currentUser?.user_id === userId) {
    return (
      store.currentUser.display_name ||
      store.currentUser.username ||
      store.currentUser.user_id
    );
  }
  return userId;
};

const openUserSettings = (userId: string) => {
  void router.push({
    name: "usersettings",
    query: { user_id: userId },
  });
};

const createdByUserId = computed(() => props.task?.user_id ?? null);

const lastRunByLabel = computed(() => {
  if (!props.task) {
    return t("background_tasks.no_value");
  }
  if (props.task.last_run_user_id) {
    return resolveUserLabel(props.task.last_run_user_id, false);
  }
  if (
    props.task.user_id &&
    [TaskStatus.PENDING, TaskStatus.RUNNING].includes(props.task.status)
  ) {
    return resolveUserLabel(props.task.user_id, false);
  }
  if (!props.task.last_run) {
    return t("background_tasks.no_value");
  }
  return resolveUserLabel(undefined, Boolean(props.task.schedule));
});

const lastRunByUserId = computed(() => {
  if (!props.task) {
    return null;
  }
  if (props.task.last_run_user_id) {
    return props.task.last_run_user_id;
  }
  if (
    props.task.user_id &&
    [TaskStatus.PENDING, TaskStatus.RUNNING].includes(props.task.status)
  ) {
    return props.task.user_id;
  }
  return null;
});

const createdByLabel = computed(() => {
  if (!props.task) {
    return t("background_tasks.no_value");
  }
  return resolveUserLabel(props.task.user_id, false);
});

const formatDate = (value: string | undefined) =>
  value ? formatBackgroundTaskDate(value, t) : t("background_tasks.no_value");
</script>

<style scoped>
.details-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 18px 32px;
}

.detail-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), 0.55);
}

.detail-value {
  font-size: 14px;
  line-height: 1.5;
  color: rgba(var(--v-theme-on-surface), 0.9);
  word-break: break-word;
}

.detail-value--stacked {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.detail-inline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.detail-inline-action {
  color: rgba(var(--v-theme-on-surface), 0.55);
}

.detail-link {
  display: inline;
  margin: 0;
  border: 0;
  background: transparent;
  appearance: none;
  padding: 0;
  vertical-align: baseline;
  font-size: inherit;
  font-weight: 400;
  line-height: inherit;
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
  cursor: pointer;
}

.detail-link:hover {
  text-decoration: underline;
}

.detail-error {
  color: rgb(var(--v-theme-error));
}

.detail-warning {
  color: rgb(var(--v-theme-warning));
}

.section-title {
  font-size: 15px;
  font-weight: 600;
}

.log-output {
  max-height: 320px;
  overflow: auto;
  border-radius: 12px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  padding: 16px;
  font-family:
    ui-monospace,
    SFMono-Regular,
    SFMono-Regular,
    Menlo,
    Monaco,
    Consolas,
    Liberation Mono,
    Courier New,
    monospace;
  font-size: 13px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (min-width: 900px) {
  .details-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
