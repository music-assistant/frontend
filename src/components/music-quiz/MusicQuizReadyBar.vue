<template>
  <!-- order-last + sticky only work as a direct child of the stage's flex section -->
  <div
    class="bg-background sticky bottom-[var(--device-inset-bottom,0px)] order-last z-10 flex justify-center pt-2 pb-1"
  >
    <Button
      class="w-full max-w-sm"
      size="lg"
      :disabled="disabled"
      :data-testid="dataTestid"
      @click="emit('ready')"
    >
      <Check class="size-4" />
      <slot></slot>
    </Button>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Check } from "@lucide/vue";

defineProps<{
  disabled: boolean;
  dataTestid: string;
}>();
const emit = defineEmits<{ ready: [] }>();
</script>
