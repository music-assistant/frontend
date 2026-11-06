<template>
  <Card
    class="flex-row flex-wrap items-center gap-3 px-3 py-3 sm:px-4"
    data-testid="host-control-strip"
  >
    <span
      class="bg-primary/10 text-primary grid size-12 shrink-0 place-items-center rounded-md"
      aria-hidden="true"
    >
      <component :is="statusIcon" class="size-5" />
    </span>

    <div class="min-w-36 flex-1">
      <p
        v-if="eyebrow"
        class="text-muted-foreground truncate text-xs font-medium"
      >
        {{ eyebrow }}
      </p>
      <p class="truncate font-semibold">{{ title }}</p>
    </div>

    <!-- On a phone the actions take their own row so the text isn't squeezed. -->
    <div class="flex w-full items-center gap-2 sm:ms-auto sm:w-auto">
      <Button
        v-if="state.phase === 'lobby'"
        class="flex-1 sm:flex-none"
        data-testid="start-quiz"
        :disabled="busy"
        @click="emit('start')"
      >
        <Play class="size-4" />
        {{ startLabel }}
      </Button>
      <Button
        v-else-if="state.phase === 'answering'"
        class="flex-1 sm:flex-none"
        :disabled="busy"
        @click="emit('reveal')"
      >
        <Eye class="size-4" />
        {{ $t("providers.music_quiz.phase_reveal") }}
      </Button>
      <Button
        v-else-if="state.phase === 'reveal'"
        class="flex-1 sm:flex-none"
        :disabled="busy"
        data-testid="next-quiz"
        @click="emit('next')"
      >
        <SkipForward class="size-4" />
        {{ nextLabel }}
      </Button>
      <Button
        v-else-if="state.phase === 'finished'"
        class="flex-1 sm:flex-none"
        data-testid="play-again"
        :disabled="busy"
        @click="emit('reset')"
      >
        <RotateCcw class="size-4" />
        {{ $t("providers.music_quiz.play_again") }}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            data-testid="host-control-more"
            :aria-label="$t('providers.music_quiz.host_controls')"
            :disabled="busy"
          >
            <EllipsisVertical class="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            v-if="state.phase === 'finished'"
            data-testid="set-up-new-game"
            @click="emit('setUpNewGame')"
          >
            <Plus class="size-4" />
            {{ $t("providers.music_quiz.set_up_new_game") }}
          </DropdownMenuItem>
          <DropdownMenuItem @click="emit('present')">
            <Maximize2 class="size-4" />
            {{ $t("providers.music_quiz.enter_present_mode") }}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" @click="emit('endGame')">
            <Square class="size-4" />
            {{ $t("providers.music_quiz.end_game") }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  MusicQuizCurrentRound,
  MusicQuizSupportedHostState,
} from "@/composables/music-quiz/useMusicQuiz";
import { useMusicQuizAutoStart } from "@/composables/music-quiz/useMusicQuizAutoStart";
import { useMusicQuizRevealCountdown } from "@/composables/music-quiz/useMusicQuizRevealCountdown";
import {
  getRoundResultCount,
  type MusicQuizRoundResultCount,
} from "@/helpers/music_quiz_stats";
import { $t } from "@/plugins/i18n";
import {
  CircleCheck,
  CircleHelp,
  EllipsisVertical,
  Eye,
  Flag,
  Maximize2,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Square,
  Users,
} from "@lucide/vue";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    state: MusicQuizSupportedHostState;
    currentRound: MusicQuizCurrentRound | null;
    busy: boolean;
    isLastRound: boolean;
    revealCountdown?: boolean;
  }>(),
  { revealCountdown: false },
);
const emit = defineEmits<{
  endGame: [];
  present: [];
  start: [];
  reveal: [];
  next: [];
  reset: [];
  setUpNewGame: [];
}>();

// The strip never shows the cover or song: before the reveal they'd give the
// answer away, and at the reveal the big reveal card shows them. Instead it
// says how the round went.
const roundResult = computed(() =>
  props.state.phase === "reveal" && props.currentRound
    ? getRoundResultCount(props.state.players, props.currentRound.round_index)
    : null,
);
// A trivia round is a question. Its revealed song's title isn't in the host
// state (only the answer is), so the strip shows the question throughout
// rather than naming a song it can't know.
const isQuestionRound = computed(() => props.state.quiz_type === "trivia");
const statusIcon = computed(() => {
  if (props.state.phase === "finished") return Flag;
  if (props.state.phase === "lobby") return Users;
  if (roundResult.value) return CircleCheck;
  return CircleHelp;
});

const eyebrow = computed(() => {
  switch (props.state.phase) {
    case "lobby":
      // The header's chip says it's waiting for players, and the quiz bar
      // says where the music plays.
      return "";
    case "finished":
      return $t("providers.music_quiz.players_count", [
        props.state.players.length,
      ]);
    default:
      if (roundResult.value) {
        return $t("providers.music_quiz.strip_round_result_eyebrow", [
          (props.currentRound?.round_index ?? 0) + 1,
        ]);
      }
      return isQuestionRound.value
        ? $t("providers.music_quiz.question_number", [
            (props.currentRound?.round_index ?? 0) + 1,
          ])
        : $t("providers.music_quiz.now_playing");
  }
});
const title = computed(() => {
  switch (props.state.phase) {
    case "lobby":
      return $t("providers.music_quiz.players_count", [
        props.state.players.length,
      ]);
    case "finished":
      return $t("providers.music_quiz.game_over");
    default:
      if (roundResult.value) return roundResultText(roundResult.value);
      if (isQuestionRound.value) return props.currentRound?.question ?? "…";
      return $t("providers.music_quiz.strip_song_hidden");
  }
});

function roundResultText({ correct, total }: MusicQuizRoundResultCount) {
  if (correct === 0) return $t("providers.music_quiz.strip_round_result_none");
  if (correct === total)
    return $t("providers.music_quiz.strip_round_result_all");
  return $t("providers.music_quiz.strip_round_result", [correct, total]);
}

const { hasElapsed, isScheduled, remainingLabel } = useMusicQuizAutoStart(
  () => props.state,
);
const startLabel = computed(() => {
  if (!isScheduled.value) return $t("providers.music_quiz.start");
  if (hasElapsed.value) return $t("providers.music_quiz.start_now_waiting");
  return $t("providers.music_quiz.start_now_countdown", [remainingLabel.value]);
});

const {
  hasElapsed: revealCountdownElapsed,
  isScheduled: revealCountdownScheduled,
  remainingLabel: revealCountdownLabel,
} = useMusicQuizRevealCountdown({
  active: () => props.revealCountdown && props.state.phase === "reveal",
  autoAdvanceAt: () => props.state.current_round?.auto_advance_at,
});
const nextLabel = computed(() => {
  const defaultKey = props.isLastRound
    ? "providers.music_quiz.finish"
    : "providers.music_quiz.next";
  if (!revealCountdownScheduled.value || revealCountdownElapsed.value)
    return $t(defaultKey);
  return $t(
    props.isLastRound
      ? "providers.music_quiz.finish_quiz_countdown"
      : "providers.music_quiz.next_round_countdown",
    [revealCountdownLabel.value],
  );
});
</script>
