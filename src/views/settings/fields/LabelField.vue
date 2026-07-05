<script setup lang="ts">
import { markdownToHtml } from "@/helpers/utils";

defineProps<{ text: string }>();
</script>

<template>
  <div
    class="text-muted-foreground mt-2 mb-4 rounded-md bg-muted/50 px-3 py-2 text-sm leading-relaxed [&_a]:underline [&_p]:mb-2 [&_p:last-child]:mb-0"
  >
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-html="markdownToHtml(text)"></div>
  </div>
</template>
