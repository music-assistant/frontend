<template>
  <!-- A player who joined mid-round sees the stage's own notice instead. -->
  <template v-if="state.phase === 'answering' && canAnswerRound">
    <!-- The song card itself says what to do: drag it, or tap it. -->
    <TimelineDragPlace
      v-model:position="dragPosition"
      :entries="currentRound.timeline"
      :locked="placementLocked"
      :disabled="busy"
      @lock="lockIn"
    >
      <template #after-song>
        <div
          v-if="state.you.answer"
          ref="postPlacementRef"
          data-testid="timeline-post-placement"
          class="scroll-mt-36"
          tabindex="-1"
          aria-live="polite"
        >
          <TimelineBonusCard
            v-if="!state.you.answer.finished && activeBonus"
            v-model:text="bonusText"
            :bonus="activeBonus"
            :label="activeBonusLabel"
            :busy="busy"
            :max-length="MAX_BONUS_TEXT_LENGTH"
            @submit-text="submitTextBonus"
            @choose="submitChoiceBonus"
            @skip="skipRemainingBonuses"
          />
          <p
            v-else-if="state.you.answer.finished"
            class="text-muted-foreground text-center"
            role="status"
          >
            {{ $t("providers.music_quiz.answered") }}
          </p>
        </div>
      </template>
    </TimelineDragPlace>

    <!-- Right under the timeline, above the leaderboard; on a long timeline
           it sticks to the bottom of the screen. Sticky only works as a
           direct child of the stage's flex section. -->
    <div
      v-if="dragPosition !== null && !placementLocked"
      class="bg-background sticky bottom-[var(--device-inset-bottom,0px)] z-10 flex justify-center pt-2 pb-1"
    >
      <Button
        class="w-full max-w-sm"
        size="lg"
        :disabled="busy"
        data-testid="timeline-lock-in"
        @click="lockIn"
      >
        <Lock class="size-4" />
        {{ $t("providers.music_quiz.timeline_lock_in") }}
      </Button>
    </div>
  </template>

  <!-- No answer is covered by the result panel above. -->
  <TimelineDisplay
    v-else-if="state.phase === 'reveal'"
    :entries="currentRound.timeline"
    :highlighted-entry-id="currentRound.revealed_entry?.entry_id"
  />
</template>

<script setup lang="ts">
import TimelineBonusCard from "@/components/music-quiz/answer-types/timeline/TimelineBonusCard.vue";
import TimelineDisplay from "@/components/music-quiz/answer-types/timeline/TimelineDisplay.vue";
import TimelineDragPlace from "@/components/music-quiz/answer-types/timeline/TimelineDragPlace.vue";
import { useTimelinePostPlacementFocus } from "@/components/music-quiz/answer-types/timeline/useTimelinePostPlacementFocus";
import type {
  MusicQuizPlayerAnswerAdapterEmits,
  MusicQuizPlayerAnswerAdapterProps,
} from "@/components/music-quiz/adapter_contracts";
import { Button } from "@/components/ui/button";
import type {
  MusicQuizTimelinePersonalizedState,
  MusicQuizTimelineRound,
  MusicQuizTimelineBonusType,
} from "@/composables/music-quiz/useMusicQuiz";
import { $t } from "@/plugins/i18n";
import { Lock } from "@lucide/vue";
import { computed, ref, watch } from "vue";

const MAX_BONUS_TEXT_LENGTH = 200;

interface TimelinePlacementSelection {
  previousEntryId: string | null;
  nextEntryId: string | null;
}

const props =
  defineProps<
    MusicQuizPlayerAnswerAdapterProps<
      MusicQuizTimelinePersonalizedState,
      MusicQuizTimelineRound
    >
  >();
const emit = defineEmits<MusicQuizPlayerAnswerAdapterEmits<"timeline">>();
const bonusText = ref("");
const pendingPlacement = ref<TimelinePlacementSelection>();
const answeredBonusTypes = computed(
  () =>
    new Set(
      props.state.you.answer?.bonuses.map((answer) => answer.bonus_type) ?? [],
    ),
);
const activeBonus = computed(() => {
  const answer = props.state.you.answer;
  if (!answer || answer.finished) return undefined;
  return props.currentRound.bonus_definitions.find(
    (definition) => !answeredBonusTypes.value.has(definition.bonus_type),
  );
});
const activeBonusLabel = computed(() =>
  activeBonus.value ? bonusTypeLabel(activeBonus.value.bonus_type) : "",
);
const placementLocked = computed(
  () => !!props.state.you.answer || !!pendingPlacement.value,
);
const selectedPlacement = computed<TimelinePlacementSelection | undefined>(
  () => {
    const answer = props.state.you.answer;
    return answer
      ? {
          previousEntryId: answer.previous_entry_id,
          nextEntryId: answer.next_entry_id,
        }
      : pendingPlacement.value;
  },
);
const canAnswerRound = computed(
  () => props.state.you.active_from_round <= props.currentRound.round_index,
);
const { postPlacementRef } = useTimelinePostPlacementFocus(
  () => activeBonus.value?.bonus_type,
  () => props.busy,
);

// Dragging: where the song sits before it's locked in (null = not moved yet).
const draggedPosition = ref<number | null>(null);
const dragPosition = computed<number | null>({
  get: () => {
    const placed = selectedPlacement.value;
    return placed
      ? positionOf(placed.previousEntryId, placed.nextEntryId)
      : draggedPosition.value;
  },
  set: (position) => {
    draggedPosition.value = position;
  },
});

function positionOf(
  previousEntryId: string | null,
  nextEntryId: string | null,
) {
  const timeline = props.currentRound.timeline;
  const next = timeline.findIndex((entry) => entry.entry_id === nextEntryId);
  if (nextEntryId && next >= 0) return next;
  const previous = timeline.findIndex(
    (entry) => entry.entry_id === previousEntryId,
  );
  return previousEntryId && previous >= 0 ? previous + 1 : 0;
}

function lockIn() {
  const position = dragPosition.value;
  if (position === null) return;
  const timeline = props.currentRound.timeline;
  place(
    timeline[position - 1]?.entry_id ?? null,
    timeline[position]?.entry_id ?? null,
  );
}

watch(
  () => activeBonus.value?.bonus_type,
  () => {
    bonusText.value = "";
  },
);
watch(
  () => props.state.you.answer,
  (answer) => {
    if (answer) pendingPlacement.value = undefined;
  },
);
watch(
  () => props.busy,
  (busy, wasBusy) => {
    if (wasBusy && !busy && !props.state.you.answer) {
      pendingPlacement.value = undefined;
    }
  },
);
watch(
  () => props.currentRound.round_index,
  () => {
    pendingPlacement.value = undefined;
    draggedPosition.value = null;
  },
);

function place(previousEntryId: string | null, nextEntryId: string | null) {
  if (placementLocked.value) return;
  pendingPlacement.value = { previousEntryId, nextEntryId };
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
