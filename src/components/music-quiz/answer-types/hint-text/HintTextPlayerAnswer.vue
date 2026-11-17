<template>
  <template v-if="state.phase === 'answering'">
    <HintTextMask :mask="currentRound.mask" />
    <div class="flex justify-center">
      <HintTextHintStatus :round="currentRound" />
    </div>

    <div
      v-if="state.you.solved"
      class="border-primary bg-primary/10 flex flex-col items-center gap-1 rounded-lg border p-4 text-center"
      role="status"
      data-testid="hint-text-solved"
    >
      <span class="flex items-center gap-2 text-lg font-bold">
        <PartyPopper class="text-primary size-5" />
        {{ $t("providers.music_quiz.title_reveal_solved") }}
      </span>
      <strong class="break-words">{{ state.you.solution }}</strong>
      <span v-if="state.you.points !== undefined" class="text-primary">
        {{ $t("providers.music_quiz.title_reveal_points", [state.you.points]) }}
      </span>
      <Badge v-if="state.you.first_bonus" data-testid="hint-text-first-bonus">
        <Trophy class="size-3" />
        {{
          $t("providers.music_quiz.title_reveal_first_bonus", [
            state.you.first_bonus,
          ])
        }}
      </Badge>
    </div>

    <form v-else class="flex flex-col gap-2" @submit.prevent="submit">
      <Label for="hint-text-guess">
        {{ $t("providers.music_quiz.title_reveal_guess_label") }}
      </Label>
      <div class="flex gap-2">
        <Input
          id="hint-text-guess"
          ref="inputRef"
          v-model="guess"
          :maxlength="MUSIC_QUIZ_HINT_TEXT_MAX_GUESS_LENGTH"
          :placeholder="
            $t('providers.music_quiz.title_reveal_guess_placeholder')
          "
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          enterkeyhint="send"
          class="h-11 text-base"
          data-testid="hint-text-input"
        />
        <Button
          type="submit"
          size="lg"
          :disabled="!canSubmit"
          data-testid="hint-text-submit"
        >
          <Send class="size-4" />
          {{ $t("providers.music_quiz.title_reveal_submit_guess") }}
        </Button>
      </div>
      <p
        v-if="showAttemptsLeft"
        class="text-muted-foreground text-sm"
        role="status"
      >
        {{
          $t("providers.music_quiz.title_reveal_attempts_left", [attemptsLeft])
        }}
      </p>
    </form>

    <HintTextArtistBonus
      v-if="state.you.solved && state.you.artist_bonus"
      :bonus="state.you.artist_bonus"
      :busy="busy"
      @submit="emit('submit', $event)"
    />

    <ul
      v-if="wrongGuesses.length"
      class="m-0 flex list-none flex-col gap-1 p-0"
      :aria-label="$t('providers.music_quiz.title_reveal_your_guesses')"
    >
      <li
        v-for="(item, index) in wrongGuesses"
        :key="index"
        class="flex items-center gap-2 rounded-md border px-3 py-2"
      >
        <X class="text-destructive size-4 shrink-0" />
        <span class="min-w-0 flex-1 truncate line-through">{{
          item.text
        }}</span>
        <Badge v-if="item.close" variant="secondary">
          {{ $t("providers.music_quiz.title_reveal_close") }}
        </Badge>
      </li>
    </ul>

    <HintTextProgress :statuses="roundPlayerStatuses" />
  </template>

  <template v-else-if="state.phase === 'reveal'">
    <p
      v-if="!state.you.solved"
      class="text-destructive text-center font-semibold"
      role="status"
    >
      {{ $t("providers.music_quiz.title_reveal_not_solved") }}
    </p>
  </template>
</template>

<script setup lang="ts">
import type {
  MusicQuizPlayerAnswerAdapterEmits,
  MusicQuizPlayerAnswerAdapterProps,
} from "@/components/music-quiz/adapter_contracts";
import HintTextArtistBonus from "@/components/music-quiz/answer-types/hint-text/HintTextArtistBonus.vue";
import HintTextHintStatus from "@/components/music-quiz/answer-types/hint-text/HintTextHintStatus.vue";
import HintTextMask from "@/components/music-quiz/answer-types/hint-text/HintTextMask.vue";
import HintTextProgress from "@/components/music-quiz/answer-types/hint-text/HintTextProgress.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  MusicQuizTitleRevealPersonalizedState,
  MusicQuizTitleRevealRound,
} from "@/composables/music-quiz/useMusicQuiz";
import { getMusicQuizRoundPlayers } from "@/helpers/music_quiz";
import { MUSIC_QUIZ_HINT_TEXT_MAX_GUESS_LENGTH } from "@/helpers/music_quiz_hint_text";
import { $t } from "@/plugins/i18n";
import { PartyPopper, Send, Trophy, X } from "@lucide/vue";
import { computed, ref, watch } from "vue";

const ATTEMPTS_LEFT_WARNING_THRESHOLD = 5;

const props =
  defineProps<
    MusicQuizPlayerAnswerAdapterProps<
      MusicQuizTitleRevealPersonalizedState,
      MusicQuizTitleRevealRound
    >
  >();
const emit = defineEmits<MusicQuizPlayerAnswerAdapterEmits<"hint_text">>();

const guess = ref("");

// the component outlives its rounds, so a half-typed guess must not leak into the next song
watch(
  () => props.currentRound.round_index,
  () => {
    guess.value = "";
  },
);
const inputRef = ref<InstanceType<typeof Input> | null>(null);

const roundPlayerStatuses = computed(() =>
  getMusicQuizRoundPlayers(props.state.players, props.currentRound.round_index),
);
const attemptsLeft = computed(() => props.state.you.attempts_left ?? 0);
const showAttemptsLeft = computed(
  () =>
    props.state.you.attempts_left !== undefined &&
    attemptsLeft.value <= ATTEMPTS_LEFT_WARNING_THRESHOLD,
);
const canSubmit = computed(
  () =>
    !props.busy && !!guess.value.trim() && props.state.you.attempts_left !== 0,
);
// newest first, so the latest feedback sits right below the input
const wrongGuesses = computed(() =>
  (props.state.you.guesses ?? []).filter((item) => !item.correct).reverse(),
);

function submit() {
  const text = guess.value.trim();
  if (!text || !canSubmit.value) return;
  emit("submit", { answer_type: "hint_text", action: "guess_title", text });
  // clear and keep focus so players can keep guessing without tapping again
  guess.value = "";
  inputRef.value?.focus();
}
</script>
