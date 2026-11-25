<template>
  <TooltipIcon :label="explanation">
    <Info class="size-3.5" aria-hidden="true" />
  </TooltipIcon>
</template>

<script setup lang="ts">
import TooltipIcon from "@/components/TooltipIcon.vue";
import { Info } from "@lucide/vue";

defineProps<{
  explanation: string;
}>();
</script>
