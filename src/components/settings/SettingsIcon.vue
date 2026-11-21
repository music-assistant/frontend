<template>
  <span
    :class="
      cn(
        'flex size-10 shrink-0 items-center justify-center rounded-(--radius-lg)',
        soft ? 'bg-current/12' : 'text-white shadow-sm',
        props.class,
      )
    "
    :style="soft ? { color: colorValue } : { backgroundColor: colorValue }"
  >
    <component :is="icon" class="size-5" aria-hidden="true" />
  </span>
</template>

<script setup lang="ts">
import { SETTINGS_COLORS, type SettingsColor } from "@/helpers/settings_colors";
import { cn } from "@/lib/utils";
import { computed, type Component, type HTMLAttributes } from "vue";

/**
 * The icon of a settings section or page in its colour: a white glyph on the
 * colour, or a soft one in the colour on a tint of it.
 */
const props = defineProps<{
  icon: Component;
  color: SettingsColor;
  soft?: boolean;
  class?: HTMLAttributes["class"];
}>();

const colorValue = computed(() => SETTINGS_COLORS[props.color]);
</script>
