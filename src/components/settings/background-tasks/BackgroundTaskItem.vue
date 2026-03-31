<template>
  <ListItem
    v-if="variant === 'list'"
    link
    :show-menu-btn="true"
    @click="emit('click', task)"
    @menu="(event) => emit('menu', event, task)"
  >
    <template #prepend>
      <div :class="statusIndicatorClass" class="task-status-indicator">
        <component :is="statusIcon" :class="statusIconClass" />
      </div>
    </template>

    <template #title>
      <div class="task-name">
        {{ displayName }}
      </div>
    </template>

    <template #subtitle>
      <div class="task-meta">
        <div v-if="taskSummary" class="task-summary">
          {{ taskSummary }}
        </div>

        <div v-if="showProgressText" class="task-progress-text">
          {{ task.progress_text }}
        </div>

        <div v-if="showProgressBar" class="task-progress">
          <div class="task-progress-header">
            <span class="truncate">
              {{ task.progress_text || t("background_tasks.progress") }}
            </span>
            <span class="task-progress-value">{{ task.progress }}%</span>
          </div>
          <Progress :model-value="task.progress ?? 0" class="h-2" />
        </div>

        <div v-if="task.last_error" class="task-error">
          {{ task.last_error }}
        </div>
        <div v-else-if="failureSummary" class="task-failure">
          {{ failureSummary }}
        </div>
      </div>
    </template>

    <template #append>
      <div class="task-status-chips">
        <Badge variant="outline" :class="statusBadgeClass">
          {{ formattedStatus }}
        </Badge>
        <Badge
          v-if="isScheduled"
          variant="outline"
          class="border-slate-300 bg-slate-500/10 text-slate-700 dark:border-slate-700 dark:bg-slate-500/10 dark:text-slate-300"
        >
          {{ t("background_tasks.scheduled") }}
        </Badge>
        <Badge
          v-if="isScheduled && !task.schedule?.enabled"
          variant="outline"
          class="border-amber-300 bg-amber-500/10 text-amber-700 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
        >
          {{ t("background_tasks.disabled") }}
        </Badge>
      </div>
    </template>
  </ListItem>

  <v-card
    v-else
    class="flex-fill rounded-lg task-card"
    :class="{ 'task-card--disabled': isScheduled && !task.schedule?.enabled }"
    min-height="170px"
    @click="emit('click', task)"
  >
    <div class="task-card-content">
      <div class="task-card-header">
        <div :class="statusIndicatorClass" class="task-status-indicator">
          <component :is="statusIcon" :class="statusIconClass" />
        </div>

        <div class="task-card-info">
          <div class="task-card-title">
            {{ displayName }}
          </div>
          <div v-if="taskSummary" class="task-card-summary">
            {{ taskSummary }}
          </div>
        </div>

        <v-btn
          icon="mdi-dots-vertical"
          size="small"
          variant="text"
          class="task-card-menu"
          @click.stop="emit('menu', $event, task)"
        />
      </div>

      <div v-if="showProgressText" class="task-card-progress-text">
        {{ task.progress_text }}
      </div>

      <div v-if="showProgressBar" class="task-card-progress">
        <div class="task-progress-header">
          <span class="truncate">
            {{ task.progress_text || t("background_tasks.progress") }}
          </span>
          <span class="task-progress-value">{{ task.progress }}%</span>
        </div>
        <Progress :model-value="task.progress ?? 0" class="h-2" />
      </div>

      <div v-if="task.last_error" class="task-error">
        {{ task.last_error }}
      </div>
      <div v-else-if="failureSummary" class="task-failure">
        {{ failureSummary }}
      </div>

      <div class="task-card-footer">
        <div class="task-status-chips">
          <Badge variant="outline" :class="statusBadgeClass">
            {{ formattedStatus }}
          </Badge>
          <Badge
            v-if="isScheduled"
            variant="outline"
            class="border-slate-300 bg-slate-500/10 text-slate-700 dark:border-slate-700 dark:bg-slate-500/10 dark:text-slate-300"
          >
            {{ t("background_tasks.scheduled") }}
          </Badge>
          <Badge
            v-if="isScheduled && !task.schedule?.enabled"
            variant="outline"
            class="border-amber-300 bg-amber-500/10 text-amber-700 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
          >
            {{ t("background_tasks.disabled") }}
          </Badge>
        </div>
      </div>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import ListItem from "@/components/ListItem.vue";
import { useBackgroundTaskDisplay } from "@/composables/useBackgroundTaskDisplay";
import type { BackgroundTask } from "@/plugins/api/interfaces";
import { useI18n } from "vue-i18n";

interface Props {
  task: BackgroundTask;
  variant?: "list" | "card";
}

const props = withDefaults(defineProps<Props>(), {
  variant: "list",
});

const emit = defineEmits<{
  click: [task: BackgroundTask];
  menu: [event: Event, task: BackgroundTask];
}>();

const { t } = useI18n();
const {
  displayName,
  failureSummary,
  formattedStatus,
  isScheduled,
  showProgressBar,
  showProgressText,
  statusBadgeClass,
  statusIcon,
  statusIconClass,
  statusIndicatorClass,
  taskSummary,
} = useBackgroundTaskDisplay(() => props.task);
</script>

<style scoped>
.task-name {
  font-weight: 500;
  font-size: 16px;
}

.task-status-indicator {
  margin-inline-end: 2px;
}

.task-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 2px;
}

.task-status-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
}

.task-summary {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.7);
  line-height: 1.45;
}

.task-progress-text {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.7);
  line-height: 1.45;
}

.task-progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 520px;
  padding-top: 2px;
}

.task-progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.task-progress-value {
  flex-shrink: 0;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
}

.task-error {
  font-size: 13px;
  color: rgb(var(--v-theme-error));
  line-height: 1.45;
}

.task-failure {
  font-size: 13px;
  color: rgb(var(--v-theme-warning));
  line-height: 1.45;
}

.task-card {
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
  cursor: pointer;
}

.task-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.task-card--disabled {
  opacity: 0.75;
}

.task-card-content {
  display: flex;
  flex-direction: column;
  padding: 16px;
  height: 100%;
  min-height: 170px;
  gap: 10px;
}

.task-card-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.task-card-info {
  flex: 1;
  min-width: 0;
}

.task-card-title {
  font-size: 16px;
  font-weight: 500;
  line-height: 1.35;
}

.task-card-summary {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  line-height: 1.45;
  margin-top: 4px;
}

.task-card-menu {
  flex-shrink: 0;
  align-self: flex-start;
  margin: -4px -8px 0 0;
}

.task-card-progress-text {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.7);
  line-height: 1.45;
}

.task-card-progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 4px;
}

.task-card-footer .task-status-chips {
  justify-content: flex-start;
}
</style>
