<template>
  <TooltipProvider :delay-duration="200">
    <Tooltip>
      <TooltipTrigger as-child>
        <span
          v-bind="$attrs"
          role="img"
          tabindex="0"
          class="text-muted-foreground inline-flex"
          :aria-label="label"
        >
          <slot></slot>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{{ label }}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>

<script setup lang="ts">
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

defineOptions({
  // the providers render no element, so attributes go to the icon itself
  inheritAttrs: false,
});

interface Props {
  // the text read out for the icon and shown in its tooltip
  label: string;
}

defineProps<Props>();
</script>
