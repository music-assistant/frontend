<!--
  One slider row of the visualizer popout: icon, slider and its live value.
  Emits the value only once a drag ends.
-->
<template>
  <div class="visualizer-menu__row">
    <component :is="icon" :size="20" class="visualizer-menu__icon" />
    <Slider
      :model-value="[draft]"
      :aria-label="ariaLabel"
      :min="min"
      :max="max"
      :step="step"
      class="visualizer-menu__slider"
      @update:model-value="onChange"
      @value-commit="(v: number[]) => emit('commit', v[0] ?? defaultValue)"
    />
    <span class="visualizer-menu__value">{{ draft }}{{ unit }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, type Component } from "vue";
import { Slider } from "@/components/ui/slider";

const props = defineProps<{
  /** The persisted preference value. */
  value: number;
  /** Used when the slider reports no value. */
  defaultValue: number;
  icon: Component;
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

const onChange = (value: number[] | undefined) => {
  if (!value) return;
  draft.value = value[0] ?? props.defaultValue;
};
</script>

<style scoped>
.visualizer-menu__icon {
  flex: 0 0 auto;
}

.visualizer-menu__slider {
  flex: 1 1 auto;
}

.visualizer-menu__value {
  min-width: 4ch;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
