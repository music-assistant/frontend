<template>
  <!-- a popover, not a tooltip: tooltips never open on touch -->
  <Popover>
    <PopoverTrigger as-child>
      <button
        v-bind="$attrs"
        type="button"
        data-info-trigger
        class="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 -my-[5px] inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm outline-none focus-visible:ring-[3px]"
        :aria-label="label"
      >
        <slot />
      </button>
    </PopoverTrigger>
    <PopoverContent side="top" class="w-auto max-w-72 px-3 py-2 text-sm">
      {{ label }}
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

defineOptions({
  // the popover renders no element, so attributes go to the button itself
  inheritAttrs: false,
});

interface Props {
  // the text read out for the icon and shown in its popover
  label: string;
}

defineProps<Props>();
</script>
