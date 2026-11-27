<template>
  <!-- no variant or size: the look below replaces both, and a variant's hover
       background would hide the play button's own fill. A held Enter acts
       once, so a seek button sends a single skip -->
  <Button
    :variant="null"
    :size="null"
    class="size-10 opacity-62 transition-opacity duration-200 hover:opacity-100 focus-visible:opacity-100 active:opacity-100 [&_svg:not([class*='size-'])]:size-(--icon-size)"
    :style="{ '--icon-size': `${iconSize}px` }"
    :disabled="disabled"
    :title="label"
    :aria-label="label"
    @keydown.enter="$event.repeat && $event.preventDefault()"
  >
    <slot />
  </Button>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";

export interface Props {
  /** Size of the glyph in pixels. */
  iconSize: number;
  /** Accessible name, also shown as the tooltip. */
  label?: string;
  disabled?: boolean;
}

withDefaults(defineProps<Props>(), {
  label: undefined,
  disabled: false,
});
</script>
