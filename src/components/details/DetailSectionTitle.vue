<template>
  <div
    v-hold="onHold"
    class="flex min-w-0 gap-[10px]"
    :class="align === 'baseline' ? 'items-baseline' : 'items-center'"
    @touchstart.passive="onTouchStart"
    @click.capture="swallowClickAfterHold"
  >
    <h2
      class="m-0 overflow-hidden text-[22px] font-bold tracking-[-0.4px] text-ellipsis whitespace-nowrap text-[color:rgb(var(--v-theme-on-background))] max-[769px]:text-[19px]"
    >
      {{ title }}
    </h2>
    <slot></slot>
    <span
      v-if="meta"
      class="detail-section-title__meta text-[13px] whitespace-nowrap text-[color:rgba(var(--v-theme-on-surface),0.6)]"
    >
      {{ meta }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { useHoldToOpenMenu } from "@/composables/useHoldToOpenMenu";

withDefaults(
  defineProps<{
    title: string;
    // the text beside the title, e.g. "3" or "2 releases"
    meta?: string;
    // baseline lines a plain meta up with the title's text
    align?: "center" | "baseline";
  }>(),
  { meta: undefined, align: "center" },
);

const emit = defineEmits<{
  (e: "edit-rows"): void;
}>();

defineSlots<{
  // beside the title, e.g. a source badge
  default?: () => unknown;
}>();

// a long-press on the title opens the rows editor
const { onHold, onTouchStart, swallowClickAfterHold } = useHoldToOpenMenu(() =>
  emit("edit-rows"),
);
</script>
