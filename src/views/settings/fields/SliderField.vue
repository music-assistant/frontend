<template>
  <div
    class="flex flex-col gap-2 min-[601px]:flex-row min-[601px]:items-center min-[601px]:gap-3"
    data-testid="config-slider"
  >
    <span v-if="label" class="text-muted-foreground shrink-0 text-sm">
      {{ label }}
    </span>
    <div class="flex flex-1 items-center gap-2">
      <Slider
        :model-value="sliderValue"
        :min="min"
        :max="max"
        :step="step"
        :disabled="disabled"
        :thumb-label="label"
        class="flex-1"
        @update:model-value="onSlide"
      />
      <NumberField
        :model-value="number"
        :disabled="disabled"
        :min="min"
        :max="max"
        :step="step"
        :format-options="formatOptions"
        class="w-[100px] shrink-0"
        @update:model-value="emit('update:value', $event ?? null)"
      >
        <NumberFieldContent>
          <NumberFieldInput :aria-label="label || undefined" />
          <NumberFieldDecrement />
          <NumberFieldIncrement />
        </NumberFieldContent>
      </NumberField>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";
import { Slider } from "@/components/ui/slider";
import type { ConfigValueType } from "@/plugins/api/interfaces";
import { computed } from "vue";

/** A number within a range: a slider, with a number field to type the exact value. */
const props = defineProps<{
  label: string;
  value?: ConfigValueType;
  min: number;
  max: number;
  // a float moves in halves, an integer in whole steps
  float?: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{ "update:value": [value: ConfigValueType] }>();

const step = computed(() => (props.float ? 0.5 : 1));
const number = computed(() =>
  typeof props.value === "number" ? props.value : undefined,
);
const sliderValue = computed(() => [number.value ?? props.min]);
const formatOptions = computed(() => ({
  maximumFractionDigits: props.float ? 1 : 0,
}));

const onSlide = (values: number[] | undefined) => {
  if (values?.length) emit("update:value", values[0]);
};
</script>
