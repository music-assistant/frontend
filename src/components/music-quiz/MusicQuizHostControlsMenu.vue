<template>
  <div>
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          class="px-2"
          data-testid="guest-host-controls"
          :aria-label="$t('providers.music_quiz.host_controls')"
          :title="$t('providers.music_quiz.host_controls')"
        >
          <SlidersHorizontal class="size-4" aria-hidden="true" />
          <span class="hidden sm:inline">
            {{ $t("providers.music_quiz.host_controls") }}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" class="w-56">
        <DropdownMenuLabel>
          {{ $t("providers.music_quiz.host_controls") }}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <template v-if="activeState">
          <DropdownMenuItem
            v-if="activeState.phase === 'lobby'"
            data-testid="quiz-host-start"
            :disabled="busy"
            @click="start"
          >
            <Play aria-hidden="true" />
            {{ $t("providers.music_quiz.start") }}
          </DropdownMenuItem>
          <DropdownMenuItem
            v-else-if="activeState.phase === 'answering'"
            data-testid="quiz-host-reveal"
            :disabled="busy"
            @click="reveal"
          >
            <Eye aria-hidden="true" />
            {{ $t("providers.music_quiz.phase_reveal") }}
          </DropdownMenuItem>
          <DropdownMenuItem
            v-else-if="activeState.phase === 'reveal'"
            data-testid="quiz-host-next"
            :disabled="busy"
            @click="next"
          >
            <SkipForward aria-hidden="true" />
            {{ nextLabel }}
          </DropdownMenuItem>
          <DropdownMenuItem
            v-else-if="activeState.phase === 'finished'"
            data-testid="quiz-host-replay"
            :disabled="busy"
            @click="replay"
          >
            <RotateCcw aria-hidden="true" />
            {{ $t("providers.music_quiz.play_again") }}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </template>
        <DropdownMenuItem
          data-testid="quiz-host-panel"
          @click="emit('openHostPanel')"
        >
          <ArrowLeft aria-hidden="true" />
          {{ $t("providers.music_quiz.return_to_host_panel") }}
        </DropdownMenuItem>
        <template v-if="state">
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            data-testid="quiz-host-end"
            :disabled="busy"
            @click="showEndGameDialog = true"
          >
            <Square aria-hidden="true" />
            {{ $t("providers.music_quiz.end_game") }}
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenu>

    <MusicQuizEndGameDialog
      v-model="showEndGameDialog"
      :busy="busy"
      @confirm="confirmEndGame"
    />
  </div>
</template>

<script setup lang="ts">
import MusicQuizEndGameDialog from "@/components/music-quiz/MusicQuizEndGameDialog.vue";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  isSupportedMusicQuiz,
  type MusicQuizSupportedHostState,
} from "@/composables/useMusicQuiz";
import { useMusicQuizHost } from "@/composables/useMusicQuizHost";
import { $t } from "@/plugins/i18n";
import {
  ArrowLeft,
  Eye,
  Play,
  RotateCcw,
  SkipForward,
  SlidersHorizontal,
  Square,
} from "@lucide/vue";
import { computed, ref } from "vue";
import { toast } from "vue-sonner";

const emit = defineEmits<{
  openHostPanel: [];
}>();
const host = useMusicQuizHost({
  loadSetupData: false,
  notifyError: (message) => toast.error(message),
});
const { state, busy, isLastRound, start, reveal, next, replay, deleteGame } =
  host;
const activeState = computed<MusicQuizSupportedHostState | null>(() => {
  const currentState = state.value;
  return currentState && isSupportedMusicQuiz(currentState)
    ? currentState
    : null;
});
const nextLabel = computed(() =>
  $t(
    isLastRound.value
      ? "providers.music_quiz.finish"
      : "providers.music_quiz.next",
  ),
);
const showEndGameDialog = ref(false);

async function confirmEndGame() {
  await deleteGame();
}
</script>
