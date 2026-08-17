<script setup lang="ts">
import { TriangleAlert } from "@lucide/vue";
import MarkdownText from "@/components/MarkdownText.vue";
import { Alert, AlertDescription } from "@/components/ui/alert";

defineProps<{ text: string }>();
</script>

<template>
  <Alert variant="warning" class="mt-2 mb-4">
    <TriangleAlert />
    <AlertDescription>
      <MarkdownText :text="text" />
    </AlertDescription>
  </Alert>
</template>
