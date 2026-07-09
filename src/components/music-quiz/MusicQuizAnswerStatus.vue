<template>
  <section class="quiz-answer-status">
    <header>
      <span>{{ $t("music_quiz.answers") }}</span>
      <small>{{ answeredCount }} / {{ statuses.length }}</small>
    </header>
    <ul>
      <li
        v-for="player in statuses"
        :key="player.name"
        :class="{ 'is-answered': player.answered }"
      >
        <Check v-if="player.answered" class="size-4" />
        <Clock v-else class="size-4" />
        <span>{{ player.name }}</span>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import type { MusicQuizPlayer } from "@/composables/useMusicQuiz";
import { $t } from "@/plugins/i18n";
import { Check, Clock } from "@lucide/vue";

defineProps<{
  statuses: MusicQuizPlayer[];
  answeredCount: number;
}>();
</script>

<style scoped>
.quiz-answer-status {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--card));
  padding: 0.875rem;
}

.quiz-answer-status header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.625rem;
  font-weight: 600;
}

.quiz-answer-status small {
  color: hsl(var(--muted-foreground));
}

.quiz-answer-status ul {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.quiz-answer-status li {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  background: hsl(var(--background));
  padding: 0.55rem 0.65rem;
  color: hsl(var(--muted-foreground));
}

.quiz-answer-status li.is-answered {
  color: hsl(var(--foreground));
}

.quiz-answer-status svg {
  flex: 0 0 auto;
}

.quiz-answer-status li.is-answered svg {
  color: hsl(var(--primary));
}

.quiz-answer-status li span {
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
