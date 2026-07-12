<template>
  <div class="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)]">
    <MusicQuizQrCard
      class="lg:w-72"
      :join-link="joinLink"
      :caption="$t('providers.music_quiz.invite_players')"
    />

    <div class="flex flex-col gap-4">
      <slot name="game" />

      <div
        v-if="showActions"
        class="bg-muted/40 flex min-h-14 flex-wrap items-center justify-end gap-2 rounded-lg border p-2"
        data-testid="quiz-host-actions"
      >
        <Button
          :disabled="busy"
          type="button"
          variant="outline"
          @click="emit('present')"
        >
          <Maximize2 class="size-4" />
          {{ $t("providers.music_quiz.enter_present_mode") }}
        </Button>
        <Button
          :disabled="busy"
          type="button"
          variant="destructive"
          @click="emit('endGame')"
        >
          <Square class="size-4" />
          {{ $t("providers.music_quiz.end_game") }}
        </Button>
        <Button
          v-if="state.phase === 'lobby'"
          data-testid="start-quiz"
          :disabled="busy"
          @click="emit('start')"
        >
          <Play class="size-4" />
          {{ startLabel }}
        </Button>
        <Button
          v-if="state.phase === 'answering'"
          :disabled="busy"
          @click="emit('reveal')"
        >
          <Eye class="size-4" />
          {{ $t("providers.music_quiz.phase_reveal") }}
        </Button>
        <Button
          v-if="state.phase === 'reveal'"
          :disabled="busy"
          @click="emit('next')"
        >
          <SkipForward class="size-4" />
          {{
            isLastRound
              ? $t("providers.music_quiz.finish")
              : $t("providers.music_quiz.next")
          }}
        </Button>
        <ButtonGroup v-if="state.phase === 'finished'" class="w-full sm:w-fit">
          <Button
            class="grow sm:grow-0"
            data-testid="play-again"
            :disabled="busy"
            type="button"
            @click="emit('reset')"
          >
            <RotateCcw class="size-4" />
            {{ $t("providers.music_quiz.play_again") }}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                size="icon"
                data-testid="play-again-menu"
                :aria-label="$t('providers.music_quiz.set_up_new_game')"
                :disabled="busy"
                type="button"
              >
                <ChevronDown class="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                data-testid="set-up-new-game"
                :disabled="busy"
                @click="emit('setUpNewGame')"
              >
                <Plus class="size-4" />
                {{ $t("providers.music_quiz.set_up_new_game") }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ButtonGroup>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import MusicQuizQrCard from "@/components/music-quiz/MusicQuizQrCard.vue";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MusicQuizSupportedHostState } from "@/composables/useMusicQuiz";
import { useMusicQuizAutoStart } from "@/composables/useMusicQuizAutoStart";
import { $t } from "@/plugins/i18n";
import {
  ChevronDown,
  Eye,
  Maximize2,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Square,
} from "@lucide/vue";
import { computed, type VNode } from "vue";

const props = withDefaults(
  defineProps<{
    state: MusicQuizSupportedHostState;
    busy: boolean;
    joinLink: string;
    isLastRound: boolean;
    showActions?: boolean;
  }>(),
  {
    showActions: true,
  },
);
defineSlots<{ game: () => VNode[] }>();
const emit = defineEmits<{
  endGame: [];
  present: [];
  start: [];
  reveal: [];
  next: [];
  reset: [];
  setUpNewGame: [];
}>();

const { hasElapsed, isScheduled, remainingLabel } = useMusicQuizAutoStart(
  () => props.state,
);
const startLabel = computed(() => {
  if (!isScheduled.value) return $t("providers.music_quiz.start");
  if (hasElapsed.value) {
    return $t("providers.music_quiz.start_now_waiting");
  }
  return $t("providers.music_quiz.start_now_countdown", [remainingLabel.value]);
});
</script>
