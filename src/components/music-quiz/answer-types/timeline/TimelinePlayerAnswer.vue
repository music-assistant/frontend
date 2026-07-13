<template>
  <template v-if="state.phase === 'answering'">
    <template v-if="canAnswerRound">
      <div class="flex flex-col items-center gap-2">
        <MusicQuizCountdown
          :size="120"
          :fraction="remainingFraction"
          :label="remainingLabel || '…'"
        />
        <p class="text-center text-lg font-bold">
          {{
            state.you.answer
              ? $t("providers.music_quiz.timeline_placement_locked")
              : $t("providers.music_quiz.timeline_choose_position")
          }}
        </p>
      </div>

      <div
        v-if="state.you.answer"
        ref="postPlacementRef"
        data-testid="timeline-post-placement"
        class="scroll-mt-3"
        tabindex="-1"
        aria-live="polite"
      >
        <Card v-if="!state.you.answer.finished && activeBonus">
          <CardContent class="flex flex-col gap-4">
            <div>
              <h2 class="font-semibold">{{ activeBonusLabel }}</h2>
              <p class="text-muted-foreground text-sm">
                {{ $t("providers.music_quiz.timeline_bonus_optional") }}
              </p>
            </div>

            <form
              v-if="activeBonus.mode === 'free_text'"
              class="flex flex-col gap-3"
              @submit.prevent="submitTextBonus"
            >
              <Label :for="`timeline-${activeBonus.bonus_type}-answer`">
                {{ activeBonusLabel }}
              </Label>
              <Input
                :id="`timeline-${activeBonus.bonus_type}-answer`"
                v-model="bonusText"
                :disabled="busy"
                :maxlength="MAX_BONUS_TEXT_LENGTH"
                autocomplete="off"
              />
              <Button type="submit" :disabled="busy || !bonusText.trim()">
                <Send class="size-4" />
                {{ $t("providers.music_quiz.timeline_submit_bonus") }}
              </Button>
            </form>

            <div v-else class="grid gap-2 sm:grid-cols-2">
              <Button
                v-for="option in activeBonus.options"
                :key="option.option_id"
                type="button"
                variant="outline"
                class="h-auto min-h-14 justify-start whitespace-normal text-left"
                :disabled="busy"
                @click="submitChoiceBonus(option.option_id)"
              >
                {{ option.label }}
              </Button>
            </div>

            <Button
              type="button"
              variant="outline"
              :disabled="busy"
              @click="skipRemainingBonuses"
            >
              <SkipForward class="size-4" />
              {{ $t("providers.music_quiz.timeline_skip_remaining_bonuses") }}
            </Button>
          </CardContent>
        </Card>

        <p
          v-else-if="state.you.answer.finished"
          class="text-muted-foreground text-center"
          role="status"
        >
          {{ $t("providers.music_quiz.answered") }}
        </p>
      </div>

      <TimelineDisplay
        :entries="currentRound.timeline"
        :selectable="true"
        :disabled="busy || !!state.you.answer"
        :selected-previous-entry-id="
          state.you.answer?.previous_entry_id ?? undefined
        "
        :selected-next-entry-id="state.you.answer?.next_entry_id ?? undefined"
        @select="place"
      />
    </template>

    <p v-else class="text-muted-foreground text-center" role="status">
      {{ $t("providers.music_quiz.waiting_for_next") }}
    </p>

    <TimelineProgress :statuses="roundPlayerStatuses" />
  </template>

  <template v-else-if="state.phase === 'reveal'">
    <TimelineDisplay
      :entries="currentRound.timeline"
      :highlighted-entry-id="currentRound.revealed_entry?.entry_id"
    />

    <div
      v-if="state.you.answer"
      class="flex flex-col gap-2 rounded-lg p-3"
      :class="
        state.you.answer.correct
          ? 'bg-green-500/15 text-green-700 dark:text-green-400'
          : 'bg-red-500/10 text-destructive'
      "
      role="status"
    >
      <div class="flex items-center justify-center gap-2 font-semibold">
        <CircleCheck
          v-if="state.you.answer.correct"
          class="size-5"
          aria-hidden="true"
        />
        <CircleX v-else class="size-5" aria-hidden="true" />
        {{
          state.you.answer.correct
            ? $t("providers.music_quiz.timeline_correct_placement")
            : $t("providers.music_quiz.timeline_incorrect_placement")
        }}
        <span>+{{ state.you.answer.points ?? 0 }}</span>
      </div>
      <div
        v-for="result in state.you.answer.bonus_results"
        :key="result.bonus_type"
        class="flex items-center justify-center gap-2 text-sm font-medium"
      >
        <CircleCheck v-if="result.correct" class="size-4" aria-hidden="true" />
        <CircleX v-else class="size-4" aria-hidden="true" />
        <span class="sr-only">
          {{
            result.correct
              ? $t("providers.music_quiz.correct")
              : $t("providers.music_quiz.incorrect")
          }}
        </span>
        {{ bonusTypeLabel(result.bonus_type) }}
        <span>+{{ result.points }}</span>
      </div>
    </div>
    <p
      v-else-if="!canAnswerRound"
      class="text-muted-foreground text-center"
      role="status"
    >
      {{ $t("providers.music_quiz.waiting_for_next") }}
    </p>
    <p v-else class="text-destructive text-center font-semibold" role="status">
      {{ $t("providers.music_quiz.no_answer_submitted") }}
    </p>
  </template>
</template>

<script setup lang="ts">
import TimelineDisplay from "@/components/music-quiz/answer-types/timeline/TimelineDisplay.vue";
import TimelineProgress from "@/components/music-quiz/answer-types/timeline/TimelineProgress.vue";
import { useTimelinePostPlacementFocus } from "@/components/music-quiz/answer-types/timeline/useTimelinePostPlacementFocus";
import type {
  MusicQuizPlayerAnswerAdapterEmits,
  MusicQuizPlayerAnswerAdapterProps,
} from "@/components/music-quiz/adapter_contracts";
import MusicQuizCountdown from "@/components/music-quiz/MusicQuizCountdown.vue";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  MusicQuizTimelinePersonalizedState,
  MusicQuizTimelineRound,
  MusicQuizTimelineBonusType,
} from "@/composables/music-quiz/useMusicQuiz";
import { useMusicQuizAnswerDeadline } from "@/composables/music-quiz/useMusicQuizAnswerDeadline";
import { getMusicQuizRoundPlayers } from "@/helpers/music_quiz";
import { $t } from "@/plugins/i18n";
import { CircleCheck, CircleX, Send, SkipForward } from "@lucide/vue";
import { computed, ref, watch } from "vue";

const MAX_BONUS_TEXT_LENGTH = 200;

const props =
  defineProps<
    MusicQuizPlayerAnswerAdapterProps<
      MusicQuizTimelinePersonalizedState,
      MusicQuizTimelineRound
    >
  >();
const emit = defineEmits<MusicQuizPlayerAnswerAdapterEmits<"timeline">>();

const bonusText = ref("");
const { postPlacementRef } = useTimelinePostPlacementFocus(
  () => !!props.state.you.answer,
  () => props.busy,
);
const answeredBonusTypes = computed(
  () =>
    new Set(
      props.state.you.answer?.bonuses.map((answer) => answer.bonus_type) ?? [],
    ),
);
const activeBonus = computed(() =>
  props.state.you.answer?.finished
    ? undefined
    : props.currentRound.bonus_definitions.find(
        (definition) => !answeredBonusTypes.value.has(definition.bonus_type),
      ),
);
const activeBonusLabel = computed(() =>
  activeBonus.value ? bonusTypeLabel(activeBonus.value.bonus_type) : "",
);
const canAnswerRound = computed(
  () => props.state.you.active_from_round <= props.currentRound.round_index,
);
const roundPlayerStatuses = computed(() =>
  getMusicQuizRoundPlayers(props.state.players, props.currentRound.round_index),
);
const { remainingLabel, remainingFraction } = useMusicQuizAnswerDeadline({
  active: () => props.state.phase === "answering",
  deadline: () => props.currentRound.deadline,
  duration: () => props.state.answer_duration,
});

watch(
  () => activeBonus.value?.bonus_type,
  () => {
    bonusText.value = "";
  },
);

function place(previousEntryId: string | null, nextEntryId: string | null) {
  emit("submit", {
    answer_type: "timeline",
    action: "place",
    previous_entry_id: previousEntryId,
    next_entry_id: nextEntryId,
  });
}

function submitTextBonus() {
  const definition = activeBonus.value;
  const value = bonusText.value.trim();
  if (!definition || definition.mode !== "free_text" || !value) return;
  emit("submit", {
    answer_type: "timeline",
    action: "bonus_text",
    bonus_type: definition.bonus_type,
    value,
  });
}

function submitChoiceBonus(optionId: string) {
  const definition = activeBonus.value;
  if (!definition || definition.mode !== "multiple_choice") return;
  emit("submit", {
    answer_type: "timeline",
    action: "bonus_choice",
    bonus_type: definition.bonus_type,
    option_id: optionId,
  });
}

function skipRemainingBonuses() {
  emit("submit", {
    answer_type: "timeline",
    action: "finish",
  });
}

function bonusTypeLabel(type: MusicQuizTimelineBonusType) {
  return type === "artist"
    ? $t("providers.music_quiz.timeline_artist_bonus")
    : $t("providers.music_quiz.timeline_title_bonus");
}
</script>
