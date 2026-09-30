<template>
  <TooltipProvider :delay-duration="200">
    <Tooltip v-model:open="open">
      <TooltipTrigger as-child>
        <button
          type="button"
          v-bind="$attrs"
          class="relative inline-flex items-center justify-center outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          :aria-describedby="descriptionId"
          @click.stop.prevent="open = true"
        >
          <slot></slot>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" class="z-[10001] max-w-[240px]">
        {{ description }}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
  <span :id="descriptionId" class="sr-only">{{ description }}</span>
</template>

<script setup lang="ts">
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useId, ref } from "vue";

defineOptions({ inheritAttrs: false });

defineProps<{
  description: string;
}>();

const open = ref(false);
const descriptionId = useId();
</script>
