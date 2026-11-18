<script setup lang="ts">
import { pathParts } from "@/helpers/storage";
import { computed } from "vue";

/**
 * A folder path that wraps after a slash, and inside a folder name only when that name
 * alone is longer than the line.
 */
const props = defineProps<{ path: string }>();

// each piece is an inline block, so a line breaks between pieces first and a piece
// only wraps inside itself when it does not fit on a line of its own
const parts = computed(() => pathParts(props.path));
</script>

<template>
  <span class="wrap-anywhere" data-testid="storage-path"
    ><span v-for="(part, index) in parts" :key="index" class="inline-block">{{
      part
    }}</span></span
  >
</template>
