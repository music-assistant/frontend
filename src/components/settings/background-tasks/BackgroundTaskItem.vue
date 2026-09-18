<template>
  <ListItem
    v-if="variant === 'list'"
    link
    :show-menu-btn="true"
    :menu-button-label="`${t('more_options')}: ${displayName}`"
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

  <Card
    v-else
    class="flex h-full min-h-[170px] cursor-pointer flex-col gap-3 py-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg"
    :class="{ 'opacity-75': isScheduled && !task.schedule?.enabled }"
    @click="emit('click', task)"
  >
    <div class="flex items-start gap-3 px-4">
      <div :class="statusIndicatorClass" class="task-status-indicator">
        <component :is="statusIcon" :class="statusIconClass" />
      </div>

      <div class="min-w-0 flex-1">
        <!-- the title is the focusable control; the card itself only follows the pointer -->
        <button
          type="button"
          class="cursor-pointer text-left text-base font-medium leading-snug"
          @click.stop="emit('click', task)"
        >
          {{ displayName }}
        </button>
        <div
          v-if="taskSummary"
          class="text-muted-foreground mt-1 text-sm leading-normal"
        >
          {{ taskSummary }}
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon-sm"
        class="-mt-1 -mr-2 shrink-0"
        :aria-label="`${t('more_options')}: ${displayName}`"
        :title="`${t('more_options')}: ${displayName}`"
        @click.stop="emit('menu', $event, task)"
      >
        <MoreVertical class="size-4" />
      </Button>
    </div>

    <div v-if="showProgressText" class="task-progress-text px-4">
      {{ task.progress_text }}
    </div>

    <div v-if="showProgressBar" class="flex flex-col gap-2 px-4">
      <div class="task-progress-header">
        <span class="truncate">
          {{ task.progress_text || t("background_tasks.progress") }}
        </span>
        <span class="task-progress-value">{{ task.progress }}%</span>
      </div>
      <Progress :model-value="task.progress ?? 0" class="h-2" />
    </div>

    <div v-if="task.last_error" class="task-error px-4">
      {{ task.last_error }}
    </div>
    <div v-else-if="failureSummary" class="task-failure px-4">
      {{ failureSummary }}
    </div>

    <div class="mt-auto flex flex-wrap items-center gap-2 px-4">
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
  </Card>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import ListItem from "@/components/ListItem.vue";
import { useBackgroundTaskDisplay } from "@/composables/background-tasks/useBackgroundTaskDisplay";
import type { BackgroundTask } from "@/plugins/api/interfaces";
import { MoreVertical } from "@lucide/vue";
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
</style>
