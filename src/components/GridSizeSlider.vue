<!--
  Inline cover-size slider for a listing's view-mode menu.

  Rendered as a non-selectable row so dragging adjusts the grid in place
  without closing the menu. The menu's arrow keys reach the slider's thumb
  like any other row; once there, the slider keeps its keys to itself, so
  they change the size rather than move through the menu (Escape still
  closes it). Tab moves between the slider and the eye toggle.
  The listing supplies live props even when the menu snapshots its items.
-->
<template>
  <div
    class="flex min-w-52 items-center gap-3 px-2 py-1.5"
    @click.stop
    @keydown.tab.stop
    @keydown.up.stop
    @keydown.down.stop
    @keydown.left.stop
    @keydown.right.stop
    @keydown.home.stop
    @keydown.end.stop
    @keydown.page-up.stop
    @keydown.page-down.stop
  >
    <Grid3x3 :size="18" class="shrink-0 opacity-70" aria-hidden="true" />
    <Slider
      :model-value="[size]"
      :min="GRID_SIZE_MIN"
      :max="GRID_SIZE_MAX"
      :step="1"
      :thumb-label="$t('grid_size')"
      :thumb-value-text="valueText"
      class="flex-auto"
      @update:model-value="onUpdate"
      @value-commit="onCommit"
    />
    <Grid2x2 :size="18" class="shrink-0 opacity-70" aria-hidden="true" />
    <div
      v-if="supportsActions"
      class="bg-border h-5 w-px shrink-0"
      aria-hidden="true"
    ></div>
    <Tooltip v-if="supportsActions" v-model:open="actionsTooltipOpen">
      <!-- Keep the explanation reachable when the button is disabled. -->
      <TooltipTrigger
        as="span"
        class="inline-flex"
        :tabindex="actionsFit ? undefined : 0"
        :aria-label="actionsLabel"
        @focusin="actionsTooltipOpen = true"
        @focusout="actionsTooltipOpen = false"
      >
        <Button
          variant="ghost"
          size="icon-sm"
          :class="actionsShown ? 'bg-accent' : 'opacity-60'"
          :disabled="!actionsFit"
          :aria-pressed="actionsShown"
          :aria-label="actionsLabel"
          @click="emit('toggleActions', !showActions)"
        >
          <Eye v-if="actionsShown" :size="18" />
          <EyeOff v-else :size="18" />
        </Button>
      </TooltipTrigger>
      <TooltipContent class="z-1000000">
        {{ actionsLabel }}
      </TooltipContent>
    </Tooltip>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GRID_SIZE_MAX, GRID_SIZE_MIN } from "@/helpers/grid_size";
import { $t } from "@/plugins/i18n";
import { Eye, EyeOff, Grid2x2, Grid3x3 } from "@lucide/vue";
import { computed, ref } from "vue";

interface Props {
  size: number;
  showActions?: boolean;
  actionsFit?: boolean;
  supportsActions?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showActions: true,
  actionsFit: true,
  supportsActions: true,
});

const emit = defineEmits<{
  // while dragging, to follow along in the grid
  (e: "change", size: number): void;
  // once let go, to keep
  (e: "commit", size: number): void;
  (e: "toggleActions", show: boolean): void;
}>();

const actionsShown = computed(() => props.showActions && props.actionsFit);
const actionsTooltipOpen = ref(false);
const actionsLabel = computed(() =>
  props.actionsFit ? $t("show_action_buttons") : $t("action_buttons_too_small"),
);

// the value itself is only an offset from the window's own column count, so
// say which way it goes
const valueText = computed(() => {
  if (props.size < 0) {
    const count = -props.size;
    return $t("grid_size_smaller", count, { named: { count } });
  }
  if (props.size > 0) {
    const count = props.size;
    return $t("grid_size_larger", count, { named: { count } });
  }
  return $t("grid_size_default");
});

const onUpdate = (values: number[] | undefined) => {
  if (!values?.length) return;
  emit("change", values[0]);
};

const onCommit = (values: number[]) => {
  if (!values.length) return;
  emit("commit", values[0]);
};
</script>
