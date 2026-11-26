<template>
  <div class="flex w-full flex-col gap-2 py-1">
    <label v-if="label" :for="inputId" class="text-muted-foreground text-sm">
      {{ label }}
    </label>
    <slot />
    <p v-if="error" :id="errorId" class="text-destructive m-0 text-sm">
      {{ error }}
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * A config field's label above its control, and the reason the value is
 * invalid below it.
 */
defineProps<{
  label: string;
  // the id of the control the label names
  inputId: string;
  error?: string;
  // the id the error text gets, for the control's aria-describedby
  errorId: string;
}>();
</script>
