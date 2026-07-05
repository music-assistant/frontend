<script setup lang="ts">
import { TriangleAlert } from "@lucide/vue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { markdownToHtml } from "@/helpers/utils";

defineProps<{ text: string }>();
</script>

<template>
  <Alert variant="warning" class="mt-2 mb-4">
    <TriangleAlert />
    <AlertDescription class="[&_a]:underline [&_p]:mb-2 [&_p:last-child]:mb-0">
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-html="markdownToHtml(text)"></div>
    </AlertDescription>
  </Alert>
</template>
