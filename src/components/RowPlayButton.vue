<template>
  <button
    v-if="overlay && !isTouch"
    type="button"
    class="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
    :aria-label="label"
    :disabled="disabled"
    @click.stop="(evt: MouseEvent) => emit('click', evt)"
  >
    <span
      class="flex size-7 items-center justify-center rounded-full bg-primary text-white"
    >
      <Play :size="13" fill="currentColor" :stroke-width="0" />
    </span>
  </button>
  <button
    v-else-if="!overlay && isTouch"
    type="button"
    class="flex size-7 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
    :aria-label="label"
    :disabled="disabled"
    @click.stop="(evt: MouseEvent) => emit('click', evt)"
  >
    <span
      class="flex size-[22px] items-center justify-center rounded-full bg-primary text-white"
    >
      <Play :size="11" fill="currentColor" :stroke-width="0" />
    </span>
  </button>
</template>

<script setup lang="ts">
import { Play } from "@lucide/vue";
import { useMediaQuery } from "@vueuse/core";

export interface Props {
  label: string;
  disabled?: boolean;
  // over the artwork, shown on hover: its parent needs `relative`, and the row
  // `group`. Otherwise a button of its own in the row, for touch screens where
  // nothing hovers.
  overlay?: boolean;
}
withDefaults(defineProps<Props>(), {
  disabled: false,
  overlay: false,
});

const emit = defineEmits<{
  click: [evt: MouseEvent];
}>();

// the buttons use v-if, since the !important Tailwind display utilities outrank
// the inline style v-show sets
const isTouch = useMediaQuery("(hover: none)");
</script>
