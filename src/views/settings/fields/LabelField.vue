<script setup lang="ts">
import MarkdownText from "@/components/MarkdownText.vue";

defineProps<{ text: string }>();
</script>

<template>
  <MarkdownText
    :text="text"
    class="selectable-label text-muted-foreground bg-muted/50 mt-2 mb-4 rounded-md px-3 py-2 text-sm leading-relaxed"
  />
</template>

<style scoped>
/* Label fields show read-only text the user often needs to copy (callback
   URLs, tokens, instructions), so opt back in to text selection that
   global.css disables app-wide. The descendant rule covers the rendered
   markdown, which global.css targets element-by-element. */
.selectable-label,
.selectable-label :deep(*) {
  -webkit-user-select: text;
  user-select: text;
}

.selectable-label {
  cursor: text;
}
</style>
