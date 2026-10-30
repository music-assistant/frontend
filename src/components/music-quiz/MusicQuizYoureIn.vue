<template>
  <!-- A player who is in the game but waiting: in the lobby, or after
       joining mid-round. The slot says what they're waiting for. -->
  <div
    class="flex flex-col items-center gap-2 px-4 py-6 text-center"
    role="status"
    data-testid="music-quiz-youre-in"
  >
    <span
      class="bg-primary/10 text-primary grid size-16 place-items-center rounded-full motion-safe:animate-pulse"
      aria-hidden="true"
    >
      <Music class="size-8" />
    </span>
    <p class="text-2xl font-bold">
      {{ $t("providers.music_quiz.youre_in") }}
    </p>
    <div class="text-muted-foreground text-base">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { $t } from "@/plugins/i18n";
import { Music } from "@lucide/vue";
</script>
