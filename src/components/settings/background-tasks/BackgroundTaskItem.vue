<template>
  <Item
    v-if="variant === 'list'"
    v-hold="(event: Event) => emit('menu', event, task)"
    variant="outline"
    class="cursor-pointer"
    @click="emit('click', task)"
    @click.right.prevent="(event: Event) => emit('menu', event, task)"
  >
    <ItemMedia class="self-start">
      <div :class="statusIndicatorClass" class="me-0.5">
        <component :is="statusIcon" :class="statusIconClass" />
      </div>
    </ItemMedia>

    <ItemContent>
      <ItemTitle>
        <!-- the name is the focusable control; the row itself only follows the pointer -->
        <button
          type="button"
          class="cursor-pointer text-left text-base font-medium leading-snug"
          @click.stop="emit('click', task)"
        >
          {{ displayName }}
        </button>
      </ItemTitle>

      <div
        v-if="taskSummary"
        class="text-muted-foreground text-sm leading-normal"
      >
        {{ taskSummary }}
      </div>

      <div
        v-if="showProgressText"
        class="text-muted-foreground text-sm leading-normal"
      >
        {{ task.progress_text }}
      </div>

      <div
        v-if="showProgressBar"
        class="flex max-w-[520px] flex-col gap-2 pt-0.5"
      >
        <div
          class="text-muted-foreground flex items-center justify-between gap-4 text-xs"
        >
          <span class="truncate">
            {{ task.progress_text || t("background_tasks.progress") }}
          </span>
          <span class="text-foreground shrink-0 font-medium">
            {{ task.progress }}%
          </span>
        </div>
        <Progress :model-value="task.progress ?? 0" class="h-2" />
      </div>

      <div
        v-if="task.last_error"
        class="text-destructive text-sm leading-normal"
      >
        {{ task.last_error }}
      </div>
      <div
        v-else-if="failureSummary"
        class="text-sm leading-normal text-amber-600 dark:text-amber-400"
      >
        {{ failureSummary }}
      </div>
    </ItemContent>

    <ItemActions class="flex-wrap justify-end self-start">
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
      <Button
        variant="ghost"
        size="icon-sm"
        class="shrink-0"
        :aria-label="`${t('more_options')}: ${displayName}`"
        :title="`${t('more_options')}: ${displayName}`"
        @click.stop="emit('menu', $event, task)"
      >
        <MoreVertical class="size-4" />
      </Button>
    </ItemActions>
  </Item>

  <Card
    v-else
    class="flex h-full min-h-[170px] cursor-pointer flex-col gap-3 py-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg"
    :class="{ 'opacity-75': isScheduled && !task.schedule?.enabled }"
    @click="emit('click', task)"
  >
    <div class="flex items-start gap-3 px-4">
      <div :class="statusIndicatorClass" class="me-0.5">
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

    <div
      v-if="showProgressText"
      class="text-muted-foreground px-4 text-sm leading-normal"
    >
      {{ task.progress_text }}
    </div>

    <div v-if="showProgressBar" class="flex flex-col gap-2 px-4">
      <div
        class="text-muted-foreground flex items-center justify-between gap-4 text-xs"
      >
        <span class="truncate">
          {{ task.progress_text || t("background_tasks.progress") }}
        </span>
        <span class="text-foreground shrink-0 font-medium">
          {{ task.progress }}%
        </span>
      </div>
      <Progress :model-value="task.progress ?? 0" class="h-2" />
    </div>

    <div
      v-if="task.last_error"
      class="text-destructive px-4 text-sm leading-normal"
    >
      {{ task.last_error }}
    </div>
    <div
      v-else-if="failureSummary"
      class="px-4 text-sm leading-normal text-amber-600 dark:text-amber-400"
    >
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
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
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
