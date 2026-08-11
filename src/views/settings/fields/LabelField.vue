<script setup lang="ts">
import MarkdownText from "@/components/MarkdownText.vue";

defineProps<{ text: string }>();
</script>

<template>
  <MarkdownText
    :text="text"
    class="text-muted-foreground bg-muted/50 mt-2 mb-4 rounded-md px-3 py-2 text-sm leading-relaxed"
  />
</template>
