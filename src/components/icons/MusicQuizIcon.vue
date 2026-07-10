<script setup lang="ts">
import { MicVocal } from "@lucide/vue";

defineOptions({
  name: "MusicQuizIcon",
});

const props = withDefaults(
  defineProps<{
    strokeWidth?: number;
  }>(),
  {
    strokeWidth: 2,
  },
);
</script>

<template>
  <MicVocal :stroke-width="props.strokeWidth" />
</template>
