<script lang="ts" setup>
import { cn } from "@/lib/utils";
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-vue-next";
import type { ToasterProps } from "vue-sonner";
import { Toaster as Sonner } from "vue-sonner";

const props = defineProps<ToasterProps>();
</script>

<template>
  <Sonner
    :class="cn('toaster group', props.class)"
    :style="{
      '--normal-bg': 'var(--popover)',
      '--normal-text': 'var(--popover-foreground)',
      '--normal-border': 'var(--border)',
      '--border-radius': 'var(--radius)',
    }"
    v-bind="props"
  >
    <template #success-icon>
      <CircleCheckIcon class="size-4" />
    </template>
    <template #info-icon>
      <InfoIcon class="size-4" />
    </template>
    <template #warning-icon>
      <TriangleAlertIcon class="size-4" />
    </template>
    <template #error-icon>
      <OctagonXIcon class="size-4" />
    </template>
    <template #loading-icon>
      <div>
        <Loader2Icon class="size-4 animate-spin" />
      </div>
    </template>
    <template #close-icon>
      <XIcon class="size-4" />
    </template>
  </Sonner>
</template>

<style>
/*
 * Make the toast action button read as a darker variant of the toast bg
 * instead of the default high-contrast popover-foreground button.
 * Each toast type swaps the bg/text vars so the button picks up the
 * toast's strong color as its background.
 */
[data-rich-colors="true"][data-sonner-toast][data-type="success"]
  [data-button] {
  background: var(--success-text);
  color: var(--success-bg);
}
[data-rich-colors="true"][data-sonner-toast][data-type="info"] [data-button] {
  background: var(--info-text);
  color: var(--info-bg);
}
[data-rich-colors="true"][data-sonner-toast][data-type="warning"]
  [data-button] {
  background: var(--warning-text);
  color: var(--warning-bg);
}
[data-rich-colors="true"][data-sonner-toast][data-type="error"] [data-button] {
  background: var(--error-text);
  color: var(--error-bg);
}
</style>
