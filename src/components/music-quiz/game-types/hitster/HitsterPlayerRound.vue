<template>
  <template v-if="state.phase === 'reveal'">
    <HitsterTimelineView :round="currentRound" />
    <Button
      size="lg"
      :disabled="busy || state.you.ready"
      @click="emit('ready')"
    >
      <Check class="size-4" />
      {{
        state.you.ready
          ? $t("providers.music_quiz.waiting_for_next")
          : $t("providers.music_quiz.ready")
      }}
    </Button>
  </template>
</template>

<script setup lang="ts">
import type {
  MusicQuizPlayerGameAdapterEmits,
  MusicQuizPlayerGameAdapterProps,
} from "@/components/music-quiz/adapter_contracts";
import HitsterTimelineView from "@/components/music-quiz/game-types/hitster/HitsterTimelineView.vue";
import { Button } from "@/components/ui/button";
import type {
  MusicQuizHitsterPersonalizedState,
  MusicQuizTimelineRound,
} from "@/composables/useMusicQuiz";
import { $t } from "@/plugins/i18n";
import { Check } from "@lucide/vue";

defineProps<
  MusicQuizPlayerGameAdapterProps<
    MusicQuizHitsterPersonalizedState,
    MusicQuizTimelineRound
  >
>();
const emit = defineEmits<MusicQuizPlayerGameAdapterEmits>();
</script>
