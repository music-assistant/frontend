<!--
  One slider row of the visualizer settings page: label and description on the
  left, the slider and its live value on the right. Emits the value only once
  a drag ends.
-->
<template>
  <div
    class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
  >
    <div class="min-w-0">
      <div class="font-medium">{{ label }}</div>
      <div class="text-sm text-muted-foreground">{{ description }}</div>
    </div>
    <div class="flex w-full shrink-0 items-center gap-3 sm:w-64">
      <Slider
        :model-value="[draft]"
        :aria-label="ariaLabel"
        :min="min"
        :max="max"
        :step="step"
        @update:model-value="
          (v: number[] | undefined) => (draft = v?.[0] ?? defaultValue)
        "
        @value-commit="(v: number[]) => emit('commit', v[0] ?? defaultValue)"
      />
      <span class="w-12 text-right text-sm tabular-nums"
        >{{ draft }}{{ unit }}</span
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { Slider } from "@/components/ui/slider";

const props = defineProps<{
  /** The persisted preference value. */
  value: number;
  /** Used when the slider reports no value. */
  defaultValue: number;
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  /** Suffix of the value readout, such as "%". */
  unit: string;
  ariaLabel?: string;
}>();

const emit = defineEmits<{
  commit: [value: number];
}>();

// Track drags locally so the readout stays live; the preference is persisted
// only on commit (drag end) — every write is a full api.updateUser round-trip
// that replaces the whole preferences object.
const draft = ref(props.value);
watch(
  () => props.value,
  (value) => (draft.value = value),
);
</script>
