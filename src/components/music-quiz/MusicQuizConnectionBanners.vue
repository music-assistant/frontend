<template>
  <div v-if="degraded" class="quiz-banner" role="status">
    <Loader2 class="size-4 animate-spin" />
    {{ $t("providers.music_quiz.connection_lost") }}
  </div>
</template>

<script setup lang="ts">
import { Loader2 } from "@lucide/vue";

defineProps<{ degraded: boolean }>();
</script>

<style scoped>
.quiz-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--card));
  padding: 0.625rem 0.875rem;
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
}
</style>
