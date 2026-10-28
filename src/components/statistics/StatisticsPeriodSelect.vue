<template>
  <div class="flex items-center gap-3">
    <label
      :for="selectId"
      :class="hideLabel ? 'sr-only' : 'text-[13px] text-muted-foreground'"
    >
      {{ $t("statistics_period") }}
    </label>
    <NativeSelect
      :id="selectId"
      v-model="selected"
      class="w-auto cursor-pointer"
    >
      <NativeSelectOption
        v-for="option in STATISTICS_PERIODS"
        :key="option"
        :value="option"
      >
        {{ $t(`period_${option}`) }}
      </NativeSelectOption>
    </NativeSelect>
  </div>
</template>

<script setup lang="ts">
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  isStatisticsPeriod,
  STATISTICS_PERIODS,
} from "@/helpers/statistics_period";
import type { StatisticsPeriod } from "@/plugins/api/interfaces";
import type { AcceptableValue } from "reka-ui";
import { computed, useId } from "vue";
import { $t } from "@/plugins/i18n";

defineProps<{
  // the label stays for screen readers when the context already says it
  hideLabel?: boolean;
}>();

const period = defineModel<StatisticsPeriod>({ required: true });
const selectId = useId();

const selected = computed({
  get: () => period.value,
  set: (value: AcceptableValue | AcceptableValue[]) => {
    if (isStatisticsPeriod(value)) period.value = value;
  },
});
</script>
