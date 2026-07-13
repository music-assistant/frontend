<template>
  <div
    ref="statusElement"
    class="bg-background flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center"
    role="status"
    aria-live="polite"
    aria-atomic="true"
    tabindex="-1"
    data-testid="music-quiz-preparing"
  >
    <LoaderCircle class="text-primary size-8 animate-spin" aria-hidden="true" />
    <div class="flex flex-col gap-1">
      <h2 class="text-lg font-semibold">
        {{ $t("providers.music_quiz.preparing_game") }}
      </h2>
      <p class="text-muted-foreground max-w-md text-sm">
        {{ $t("providers.music_quiz.preparing_game_help") }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { $t } from "@/plugins/i18n";
import { LoaderCircle } from "@lucide/vue";
import { onMounted, ref } from "vue";

const statusElement = ref<HTMLElement | null>(null);

onMounted(() => {
  statusElement.value?.focus({ preventScroll: true });
});
</script>
