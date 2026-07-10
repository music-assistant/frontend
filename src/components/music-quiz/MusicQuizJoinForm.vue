<template>
  <form class="quiz-join" @submit.prevent="submit">
    <h1>{{ sessionName }}</h1>
    <label>
      {{ $t("providers.music_quiz.player_name") }}
      <input
        ref="nameInput"
        v-model="playerName"
        autofocus
        autocomplete="nickname"
        autocapitalize="words"
        enterkeyhint="done"
        type="text"
      />
    </label>
    <Button :disabled="busy || !playerName.trim()" type="submit">{{
      $t("providers.music_quiz.join")
    }}</Button>
  </form>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { nextTick, onMounted, ref } from "vue";

defineProps<{ sessionName: string; busy: boolean }>();
const emit = defineEmits<{ join: [name: string] }>();

const playerName = ref("");
const nameInput = ref<HTMLInputElement | null>(null);

function submit() {
  if (!playerName.value.trim()) return;
  emit("join", playerName.value.trim());
}

onMounted(async () => {
  await nextTick();
  nameInput.value?.focus({ preventScroll: true });
});
</script>

<style scoped>
.quiz-join {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card);
  padding: 0.875rem;
}

.quiz-join label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.quiz-join input {
  min-height: 2.75rem;
  width: 100%;
  appearance: none;
  border: 2px solid color-mix(in srgb, var(--foreground) 58%, transparent);
  border-radius: 6px;
  background: var(--background);
  box-shadow: inset 0 1px 0
    color-mix(in srgb, var(--foreground) 6%, transparent);
  padding: 0.5rem 0.625rem;
  color: var(--foreground);
  outline: none;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.quiz-join input:focus {
  border-color: var(--primary);
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--primary) 22%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--foreground) 6%, transparent);
}
</style>
