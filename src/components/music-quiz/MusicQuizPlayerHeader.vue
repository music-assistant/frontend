<template>
  <header class="quiz-header">
    <div>
      <h1>
        {{ playerName }}
        <span v-if="rank" class="quiz-header__rank">(#{{ rank }})</span>
      </h1>
      <small class="quiz-header__round-progress">{{ roundProgress }}</small>
    </div>
    <strong class="quiz-header__score">
      {{ score }}
      <span v-if="scoreDelta">{{ scoreDelta }}</span>
    </strong>
  </header>
  <div v-if="phaseLabel" class="quiz-header__phase" role="status">
    {{ phaseLabel }}
  </div>
</template>

<script setup lang="ts">
defineProps<{
  playerName: string;
  rank: number | null;
  roundProgress: string;
  score: number;
  scoreDelta: string;
  phaseLabel: string;
}>();
</script>

<style scoped>
.quiz-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--card));
  padding: 0.875rem;
}

.quiz-header > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.2rem;
}

.quiz-header h1 {
  margin: 0;
}

.quiz-header__rank {
  color: hsl(var(--muted-foreground));
  font-size: 0.85em;
  font-weight: 600;
  white-space: nowrap;
}

.quiz-header__round-progress {
  color: hsl(var(--muted-foreground));
  font-size: 0.85rem;
  font-weight: 600;
}

.quiz-header__score {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: baseline;
  gap: 0.35rem;
  white-space: nowrap;
}

.quiz-header__score span {
  color: hsl(var(--primary));
  font-size: 0.85rem;
}

.quiz-header__phase {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 2.4rem;
  border: 1px solid hsl(var(--primary) / 0.35);
  border-radius: 8px;
  background: hsl(var(--primary) / 0.1);
  padding: 0.5rem 0.75rem;
  color: hsl(var(--foreground));
  font-size: 0.95rem;
  font-weight: 800;
  text-align: center;
}
</style>
