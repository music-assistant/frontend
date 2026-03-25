<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader class="gap-3">
        <DialogTitle>
          {{ t("background_tasks.schedule_dialog.title") }}
        </DialogTitle>
        <DialogDescription>
          {{
            task
              ? t("background_tasks.schedule_dialog.description", [
                  getBackgroundTaskName(task, t, te),
                ])
              : t("background_tasks.schedule_dialog.empty_description")
          }}
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-5 py-2">
        <div class="flex flex-col gap-2">
          <Label for="task-schedule-type">
            {{ t("background_tasks.schedule_dialog.type") }}
          </Label>
          <Select v-model="scheduleType" :disabled="saving || !task">
            <SelectTrigger id="task-schedule-type" class="w-full">
              <SelectValue
                :placeholder="t('background_tasks.schedule_dialog.type')"
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem :value="TaskScheduleType.HOURLY">
                {{ t("background_tasks.schedule_dialog.hourly") }}
              </SelectItem>
              <SelectItem :value="TaskScheduleType.DAILY">
                {{ t("background_tasks.schedule_dialog.daily") }}
              </SelectItem>
              <SelectItem :value="TaskScheduleType.WEEKLY">
                {{ t("background_tasks.schedule_dialog.weekly") }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div
          v-if="scheduleType === TaskScheduleType.HOURLY"
          class="flex flex-col gap-2"
        >
          <Label for="task-schedule-every-hours">
            {{ t("background_tasks.schedule_dialog.every_hours") }}
          </Label>
          <NumberField
            id="task-schedule-every-hours"
            :model-value="every"
            :min="1"
            :step="1"
            :format-options="{ maximumFractionDigits: 0 }"
            :disabled="saving || !task"
            @update:model-value="(value) => updateEvery(value)"
          >
            <NumberFieldContent>
              <NumberFieldInput />
              <NumberFieldDecrement />
              <NumberFieldIncrement />
            </NumberFieldContent>
          </NumberField>
        </div>

        <template v-else-if="scheduleType === TaskScheduleType.DAILY">
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="flex flex-col gap-2">
              <Label for="task-schedule-every-days">
                {{ t("background_tasks.schedule_dialog.every_days") }}
              </Label>
              <NumberField
                id="task-schedule-every-days"
                :model-value="every"
                :min="1"
                :step="1"
                :format-options="{ maximumFractionDigits: 0 }"
                :disabled="saving || !task"
                @update:model-value="(value) => updateEvery(value)"
              >
                <NumberFieldContent>
                  <NumberFieldInput />
                  <NumberFieldDecrement />
                  <NumberFieldIncrement />
                </NumberFieldContent>
              </NumberField>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <div class="flex flex-col gap-2">
                <Label for="task-schedule-hour">
                  {{ t("background_tasks.schedule_dialog.hour") }}
                </Label>
                <NumberField
                  id="task-schedule-hour"
                  :model-value="hour"
                  :min="0"
                  :max="23"
                  :step="1"
                  :format-options="{ maximumFractionDigits: 0 }"
                  :disabled="saving || !task"
                  @update:model-value="(value) => updateHour(value)"
                >
                  <NumberFieldContent>
                    <NumberFieldInput />
                    <NumberFieldDecrement />
                    <NumberFieldIncrement />
                  </NumberFieldContent>
                </NumberField>
              </div>

              <div class="flex flex-col gap-2">
                <Label for="task-schedule-minute">
                  {{ t("background_tasks.schedule_dialog.minute") }}
                </Label>
                <NumberField
                  id="task-schedule-minute"
                  :model-value="minute"
                  :min="0"
                  :max="59"
                  :step="5"
                  :format-options="{ maximumFractionDigits: 0 }"
                  :disabled="saving || !task"
                  @update:model-value="(value) => updateMinute(value)"
                >
                  <NumberFieldContent>
                    <NumberFieldInput />
                    <NumberFieldDecrement />
                    <NumberFieldIncrement />
                  </NumberFieldContent>
                </NumberField>
              </div>
            </div>
          </div>

          <p class="text-sm text-muted-foreground">
            {{
              t("background_tasks.schedule_dialog.browser_timezone", [
                browserTimeZone,
              ])
            }}
          </p>
        </template>

        <template v-else-if="scheduleType === TaskScheduleType.WEEKLY">
          <div class="flex flex-col gap-2">
            <Label>
              {{ t("background_tasks.schedule_dialog.weekdays") }}
            </Label>
            <div class="weekday-grid">
              <label
                v-for="day in weekdayOptions"
                :key="day.value"
                class="weekday-option"
              >
                <Checkbox
                  :checked="selectedDays.includes(day.value)"
                  @click.stop="toggleDay(day.value)"
                />
                <span @click.stop="toggleDay(day.value)">
                  {{ day.label }}
                </span>
              </label>
            </div>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="flex flex-col gap-2">
              <Label for="task-schedule-weekly-hour">
                {{ t("background_tasks.schedule_dialog.hour") }}
              </Label>
              <NumberField
                id="task-schedule-weekly-hour"
                :model-value="hour"
                :min="0"
                :max="23"
                :step="1"
                :format-options="{ maximumFractionDigits: 0 }"
                :disabled="saving || !task"
                @update:model-value="(value) => updateHour(value)"
              >
                <NumberFieldContent>
                  <NumberFieldInput />
                  <NumberFieldDecrement />
                  <NumberFieldIncrement />
                </NumberFieldContent>
              </NumberField>
            </div>

            <div class="flex flex-col gap-2">
              <Label for="task-schedule-weekly-minute">
                {{ t("background_tasks.schedule_dialog.minute") }}
              </Label>
              <NumberField
                id="task-schedule-weekly-minute"
                :model-value="minute"
                :min="0"
                :max="59"
                :step="5"
                :format-options="{ maximumFractionDigits: 0 }"
                :disabled="saving || !task"
                @update:model-value="(value) => updateMinute(value)"
              >
                <NumberFieldContent>
                  <NumberFieldInput />
                  <NumberFieldDecrement />
                  <NumberFieldIncrement />
                </NumberFieldContent>
              </NumberField>
            </div>
          </div>

          <p class="text-sm text-muted-foreground">
            {{
              t("background_tasks.schedule_dialog.browser_timezone", [
                browserTimeZone,
              ])
            }}
          </p>
        </template>

        <p v-if="validationError" class="text-sm text-destructive">
          {{ validationError }}
        </p>
      </div>

      <DialogFooter>
        <Button variant="outline" :disabled="saving" @click="open = false">
          {{ t("cancel") }}
        </Button>
        <Button
          :disabled="saving || !!validationError || !task"
          @click="onSave"
        >
          {{ t("settings.save") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  convertBackgroundTaskScheduleToLocal,
  convertBackgroundTaskScheduleToUtc,
  formatLocalTaskScheduleWeekday,
  getBackgroundTaskBrowserTimeZone,
} from "@/helpers/backgroundTaskSchedule";
import { getBackgroundTaskName } from "@/helpers/backgroundTasks";
import {
  type BackgroundTask,
  type TaskSchedule,
  TaskScheduleType,
} from "@/plugins/api/interfaces";

interface Props {
  task: BackgroundTask | null;
  saving?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  saving: false,
});

const emit = defineEmits<{
  save: [schedule: TaskSchedule];
}>();

const open = defineModel<boolean>("open", { required: true });

const { t, te } = useI18n();
const browserTimeZone = getBackgroundTaskBrowserTimeZone();
const scheduleType = ref<TaskScheduleType>(TaskScheduleType.HOURLY);
const every = ref(1);
const hour = ref(0);
const minute = ref(0);
const selectedDays = ref<number[]>([]);

const weekdayOptions = computed(() =>
  Array.from({ length: 7 }, (_, index) => ({
    value: index,
    label: formatLocalTaskScheduleWeekday(index),
  })),
);

watch(
  () =>
    [
      open.value,
      props.task?.id,
      props.task?.schedule?.type,
      props.task?.schedule?.every,
      props.task?.schedule?.hour,
      props.task?.schedule?.minute,
      props.task?.schedule?.days_of_week?.join(","),
    ] as const,
  () => {
    const schedule = props.task?.schedule;
    const localSchedule = schedule
      ? convertBackgroundTaskScheduleToLocal(schedule)
      : undefined;
    scheduleType.value = localSchedule?.type ?? TaskScheduleType.HOURLY;
    every.value = localSchedule?.every ?? 1;
    hour.value = localSchedule?.hour ?? 0;
    minute.value = localSchedule?.minute ?? 0;
    selectedDays.value = [...(localSchedule?.days_of_week ?? [])];
  },
  { immediate: true },
);

const validationError = computed(() => {
  if (!props.task?.schedule) {
    return t("background_tasks.schedule_dialog.unsupported");
  }
  if (
    (scheduleType.value === TaskScheduleType.HOURLY ||
      scheduleType.value === TaskScheduleType.DAILY) &&
    (!Number.isInteger(every.value) || every.value < 1)
  ) {
    return t("background_tasks.schedule_dialog.invalid_every");
  }
  if (
    (scheduleType.value === TaskScheduleType.DAILY ||
      scheduleType.value === TaskScheduleType.WEEKLY) &&
    (!Number.isInteger(hour.value) || hour.value < 0 || hour.value > 23)
  ) {
    return t("background_tasks.schedule_dialog.invalid_hour");
  }
  if (
    (scheduleType.value === TaskScheduleType.DAILY ||
      scheduleType.value === TaskScheduleType.WEEKLY) &&
    (!Number.isInteger(minute.value) || minute.value < 0 || minute.value > 59)
  ) {
    return t("background_tasks.schedule_dialog.invalid_minute");
  }
  if (
    scheduleType.value === TaskScheduleType.WEEKLY &&
    selectedDays.value.length === 0
  ) {
    return t("background_tasks.schedule_dialog.select_weekday");
  }
  return "";
});

const updateEvery = (value: number | undefined) => {
  every.value = Math.max(1, Math.round(value ?? 1));
};

const updateHour = (value: number | undefined) => {
  hour.value = Math.min(23, Math.max(0, Math.round(value ?? 0)));
};

const updateMinute = (value: number | undefined) => {
  minute.value = Math.min(59, Math.max(0, Math.round(value ?? 0)));
};

const toggleDay = (value: number) => {
  if (selectedDays.value.includes(value)) {
    selectedDays.value = selectedDays.value.filter((day) => day !== value);
    return;
  }
  selectedDays.value = [...selectedDays.value, value].sort((a, b) => a - b);
};

const buildLocalSchedule = (): TaskSchedule => {
  const enabled = props.task?.schedule?.enabled ?? true;
  if (scheduleType.value === TaskScheduleType.HOURLY) {
    return {
      type: TaskScheduleType.HOURLY,
      enabled,
      every: every.value,
    };
  }
  if (scheduleType.value === TaskScheduleType.DAILY) {
    return {
      type: TaskScheduleType.DAILY,
      enabled,
      every: every.value,
      hour: hour.value,
      minute: minute.value,
    };
  }
  return {
    type: TaskScheduleType.WEEKLY,
    enabled,
    days_of_week: [...selectedDays.value],
    hour: hour.value,
    minute: minute.value,
  };
};

const onSave = () => {
  if (validationError.value) {
    return;
  }
  emit("save", convertBackgroundTaskScheduleToUtc(buildLocalSchedule()));
};
</script>

<style scoped>
.weekday-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 14px;
}

.weekday-option {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: rgba(var(--v-theme-on-surface), 0.8);
  cursor: pointer;
}

@media (min-width: 640px) {
  .weekday-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
