<template>
  <button
    type="button"
    class="inline cursor-pointer border-0 bg-transparent p-0 align-baseline text-inherit [font:inherit] hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    @click="emit('click')"
  >
    <!-- reads as a link in the hero's line of text, so the button chrome goes -->
    <slot />
  </button>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  (e: "click"): void;
}>();
</script>
