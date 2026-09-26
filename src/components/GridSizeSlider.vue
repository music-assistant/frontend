<!--
  Inline cover-size slider for a listing's view-mode menu.

  Rendered as a non-selectable row so dragging adjusts the grid in place
  without closing the menu. The menu's arrow keys reach the slider's thumb
  like any other row; once there, the slider keeps its keys to itself, so
  they change the size rather than move through the menu (Escape still
  closes it). Keeps its own value: the menu hands it a snapshot of its items,
  so the size it was opened with is only where it starts.
-->
<template>
  <div
    class="grid-size-row"
    @pointerdown.stop
    @click.stop
    @keydown.up.stop
    @keydown.down.stop
    @keydown.left.stop
    @keydown.right.stop
    @keydown.home.stop
    @keydown.end.stop
    @keydown.page-up.stop
    @keydown.page-down.stop
  >
    <Grid3x3 :size="18" class="grid-size-row__icon" aria-hidden="true" />
    <Slider
      :model-value="[value]"
      :min="GRID_SIZE_MIN"
      :max="GRID_SIZE_MAX"
      :step="1"
      :aria-label="$t('grid_size')"
      class="grid-size-row__slider"
      @update:model-value="onUpdate"
      @value-commit="onCommit"
    />
    <Grid2x2 :size="18" class="grid-size-row__icon" aria-hidden="true" />
  </div>
</template>

<script setup lang="ts">
import { Slider } from "@/components/ui/slider";
import { GRID_SIZE_MAX, GRID_SIZE_MIN } from "@/helpers/grid_size";
import { $t } from "@/plugins/i18n";
import { Grid2x2, Grid3x3 } from "@lucide/vue";
import { ref } from "vue";

const props = defineProps<{ size: number }>();

const emit = defineEmits<{
  // while dragging, to follow along in the grid
  (e: "change", size: number): void;
  // once let go, to keep
  (e: "commit", size: number): void;
}>();

const value = ref(props.size);

const onUpdate = (values: number[] | undefined) => {
  if (!values?.length) return;
  value.value = values[0];
  emit("change", values[0]);
};

const onCommit = (values: number[]) => {
  if (!values.length) return;
  emit("commit", values[0]);
};
</script>

<style scoped>
.grid-size-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 8px;
  min-width: 13rem;
}

.grid-size-row__icon {
  flex: 0 0 auto;
  opacity: 0.7;
}

.grid-size-row__slider {
  flex: 1 1 auto;
}
</style>
