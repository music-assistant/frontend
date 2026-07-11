<template>
  <template v-if="state.phase === 'answering'">
    <template v-if="isActivePlayer">
      <div class="flex flex-col items-center gap-2">
        <MusicQuizCountdown
          :size="120"
          :fraction="remainingFraction"
          :label="remainingLabel || '...'"
        />
        <p class="text-center text-lg font-bold">
          {{
            hasPlacement
              ? $t("providers.music_quiz.timeline_add_bonuses")
              : $t("providers.music_quiz.timeline_choose_position")
          }}
        </p>
      </div>

      <TimelineBoard
        :timeline="currentRound.timeline"
        :interactive="true"
        :disabled="busy || hasPlacement"
        :selected-boundary="selectedBoundary"
        @select="place"
      />

      <p
        v-if="hasPlacement"
        class="text-muted-foreground text-center"
        role="status"
      >
        {{ $t("providers.music_quiz.timeline_placement_locked") }}
      </p>

      <div
        v-if="serverAnswer && currentRound.bonus_definitions.length > 0"
        class="grid gap-3 sm:grid-cols-2"
      >
        <Card
          v-for="definition in currentRound.bonus_definitions"
          :key="definition.bonus_type"
          class="gap-3 py-4"
        >
          <CardHeader class="px-4">
            <CardTitle class="text-base">
              {{ bonusLabel(definition.bonus_type) }}
            </CardTitle>
            <CardAction v-if="bonusAnswer(definition.bonus_type)">
              <Badge variant="secondary">
                {{ $t("providers.music_quiz.timeline_bonus_locked") }}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent class="px-4">
            <form
              v-if="definition.mode === 'free_text'"
              class="flex flex-col gap-2"
              @submit.prevent="submitBonusText(definition.bonus_type)"
            >
              <Label :for="`timeline-${definition.bonus_type}-bonus`">
                {{ $t("providers.music_quiz.timeline_your_answer") }}
              </Label>
              <div class="flex gap-2">
                <Input
                  :id="`timeline-${definition.bonus_type}-bonus`"
                  v-model="bonusText[definition.bonus_type]"
                  :disabled="
                    busy ||
                    !!bonusAnswer(definition.bonus_type) ||
                    !!pendingAction ||
                    serverAnswer.finished
                  "
                  maxlength="200"
                  autocomplete="off"
                />
                <Button
                  type="submit"
                  :disabled="
                    busy ||
                    !!bonusAnswer(definition.bonus_type) ||
                    !!pendingAction ||
                    serverAnswer.finished ||
                    !bonusText[definition.bonus_type].trim()
                  "
                >
                  {{ $t("providers.music_quiz.timeline_lock_bonus") }}
                </Button>
              </div>
            </form>

            <div
              v-else
              class="grid gap-2"
              role="group"
              :aria-label="bonusLabel(definition.bonus_type)"
            >
              <Button
                v-for="option in definition.options"
                :key="option.option_id"
                type="button"
                class="h-auto min-h-11 justify-start whitespace-normal text-left"
                :data-option-id="option.option_id"
                :disabled="
                  busy ||
                  !!bonusAnswer(definition.bonus_type) ||
                  !!pendingAction ||
                  serverAnswer.finished
                "
                :variant="
                  selectedOptionId(definition.bonus_type) === option.option_id
                    ? 'default'
                    : 'outline'
                "
                :aria-pressed="
                  selectedOptionId(definition.bonus_type) === option.option_id
                "
                @click="
                  submitBonusChoice(definition.bonus_type, option.option_id)
                "
              >
                {{ option.label }}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Button
        v-if="
          serverAnswer &&
          currentRound.bonus_definitions.length > 0 &&
          !serverAnswer.finished
        "
        size="lg"
        :disabled="busy || !!pendingAction"
        @click="finish"
      >
        <Flag class="size-4" />
        {{ $t("providers.music_quiz.timeline_finish_answer") }}
      </Button>

      <p
        v-if="serverAnswer?.finished || finishPending"
        class="text-muted-foreground text-center"
        role="status"
      >
        {{ $t("providers.music_quiz.answered") }}
      </p>
    </template>

    <template v-else>
      <p class="text-muted-foreground text-center" role="status">
        {{ $t("providers.music_quiz.timeline_join_next_round") }}
      </p>
      <TimelineBoard :timeline="currentRound.timeline" />
    </template>

    <TimelineProgress :statuses="state.players" />
  </template>

  <Card
    v-else-if="state.phase === 'reveal' && isActivePlayer"
    class="gap-4 py-4"
  >
    <CardContent class="flex flex-col gap-3 px-4">
      <div
        v-if="serverAnswer?.correct"
        class="flex items-center justify-center gap-2 rounded-md bg-green-500/15 py-3 font-semibold text-green-600 dark:text-green-400"
        role="status"
      >
        <CircleCheck class="size-5" />
        {{ $t("providers.music_quiz.timeline_correct_placement") }}
        <span>+{{ serverAnswer.points ?? 0 }}</span>
      </div>
      <div
        v-else
        class="text-destructive flex items-center justify-center gap-2 rounded-md bg-red-500/10 py-3 font-semibold"
        role="status"
      >
        <CircleX class="size-5" />
        {{
          serverAnswer
            ? $t("providers.music_quiz.timeline_incorrect_placement")
            : $t("providers.music_quiz.no_answer_submitted")
        }}
      </div>

      <ul
        v-if="currentRound.bonus_definitions.length > 0"
        class="grid gap-2 sm:grid-cols-2"
      >
        <li
          v-for="definition in currentRound.bonus_definitions"
          :key="definition.bonus_type"
          class="bg-muted flex items-center justify-between gap-3 rounded-md px-3 py-2"
        >
          <span class="font-medium">{{
            bonusLabel(definition.bonus_type)
          }}</span>
          <span
            v-if="bonusResult(definition.bonus_type)"
            class="flex items-center gap-1 font-semibold"
            :class="
              bonusResult(definition.bonus_type)?.correct
                ? 'text-green-600 dark:text-green-400'
                : 'text-destructive'
            "
          >
            <CircleCheck
              v-if="bonusResult(definition.bonus_type)?.correct"
              class="size-4"
            />
            <CircleX v-else class="size-4" />
            +{{ bonusResult(definition.bonus_type)?.points ?? 0 }}
          </span>
          <span v-else class="text-muted-foreground text-sm">
            {{ $t("providers.music_quiz.timeline_bonus_skipped") }}
          </span>
        </li>
      </ul>
    </CardContent>
  </Card>
  <p
    v-else-if="state.phase === 'reveal'"
    class="text-muted-foreground text-center"
    role="status"
  >
    {{ $t("providers.music_quiz.timeline_join_next_round") }}
  </p>
</template>

<script setup lang="ts">
import TimelineBoard from "@/components/music-quiz/answer-types/timeline/TimelineBoard.vue";
import type { MusicQuizTimelineBoundary } from "@/components/music-quiz/answer-types/timeline/timeline";
import TimelineProgress from "@/components/music-quiz/answer-types/timeline/TimelineProgress.vue";
import type {
  MusicQuizPlayerAnswerAdapterEmits,
  MusicQuizPlayerAnswerAdapterProps,
} from "@/components/music-quiz/adapter_contracts";
import MusicQuizCountdown from "@/components/music-quiz/MusicQuizCountdown.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  MusicQuizHitsterPersonalizedState,
  MusicQuizTimelineBonusType,
  MusicQuizTimelinePersonalBonusAnswer,
  MusicQuizTimelineRound,
} from "@/composables/useMusicQuiz";
import { useMusicQuizAnswerDeadline } from "@/composables/useMusicQuizAnswerDeadline";
import { $t } from "@/plugins/i18n";
import { CircleCheck, CircleX, Flag } from "@lucide/vue";
import { computed, reactive, ref, watch } from "vue";

const props =
  defineProps<
    MusicQuizPlayerAnswerAdapterProps<
      MusicQuizHitsterPersonalizedState,
      MusicQuizTimelineRound
    >
  >();
const emit = defineEmits<MusicQuizPlayerAnswerAdapterEmits<"timeline">>();

const pendingPlacement = ref<Pick<
  MusicQuizTimelineBoundary,
  "previous_entry_id" | "next_entry_id"
> | null>(null);
const pendingBonus = ref<MusicQuizTimelinePersonalBonusAnswer | null>(null);
const finishPending = ref(false);
const bonusText = reactive<Record<MusicQuizTimelineBonusType, string>>({
  artist: "",
  title: "",
});
let observedBusy = false;

const serverAnswer = computed(() => props.state.you.answer);
const isActivePlayer = computed(
  () => props.state.you.active_from_round <= props.currentRound.round_index,
);
const selectedBoundary = computed(
  () => serverAnswer.value ?? pendingPlacement.value,
);
const hasPlacement = computed(() => !!selectedBoundary.value);
const pendingAction = computed(
  () => pendingPlacement.value || pendingBonus.value || finishPending.value,
);

const { remainingLabel, remainingFraction } = useMusicQuizAnswerDeadline({
  active: () => props.state.phase === "answering" && isActivePlayer.value,
  deadline: () => props.currentRound.deadline,
  duration: () => props.state.answer_duration,
});

watch(
  () => props.state.you.answer,
  (answer) => {
    if (!answer) return;
    pendingPlacement.value = null;
    for (const bonus of answer.bonuses) {
      if (bonus.action === "bonus_text") {
        bonusText[bonus.bonus_type] = bonus.value;
      }
    }
    if (
      pendingBonus.value &&
      answer.bonuses.some(
        (bonus) => bonus.bonus_type === pendingBonus.value?.bonus_type,
      )
    ) {
      pendingBonus.value = null;
    }
    if (answer.finished) finishPending.value = false;
  },
  { deep: true, immediate: true },
);

watch(
  () => props.busy,
  (busy) => {
    if (busy) {
      observedBusy = true;
      return;
    }
    if (!observedBusy) return;
    observedBusy = false;
    if (!props.state.you.answer) pendingPlacement.value = null;
    if (
      pendingBonus.value &&
      !props.state.you.answer?.bonuses.some(
        (bonus) => bonus.bonus_type === pendingBonus.value?.bonus_type,
      )
    ) {
      pendingBonus.value = null;
    }
    if (!props.state.you.answer?.finished) finishPending.value = false;
  },
);

function place(
  boundary: Pick<
    MusicQuizTimelineBoundary,
    "previous_entry_id" | "next_entry_id"
  >,
) {
  if (props.busy || hasPlacement.value) return;
  pendingPlacement.value = boundary;
  emit("submit", {
    answer_type: "timeline",
    action: "place",
    previous_entry_id: boundary.previous_entry_id,
    next_entry_id: boundary.next_entry_id,
  });
}

function submitBonusText(bonusType: MusicQuizTimelineBonusType) {
  const value = bonusText[bonusType].trim();
  if (!canSubmitBonus(bonusType) || !value) return;
  pendingBonus.value = {
    action: "bonus_text",
    bonus_type: bonusType,
    value,
  };
  emit("submit", {
    answer_type: "timeline",
    action: "bonus_text",
    bonus_type: bonusType,
    value,
  });
}

function submitBonusChoice(
  bonusType: MusicQuizTimelineBonusType,
  optionId: string,
) {
  if (!canSubmitBonus(bonusType)) return;
  pendingBonus.value = {
    action: "bonus_choice",
    bonus_type: bonusType,
    option_id: optionId,
  };
  emit("submit", {
    answer_type: "timeline",
    action: "bonus_choice",
    bonus_type: bonusType,
    option_id: optionId,
  });
}

function finish() {
  if (
    props.busy ||
    pendingAction.value ||
    !serverAnswer.value ||
    serverAnswer.value.finished
  ) {
    return;
  }
  finishPending.value = true;
  emit("submit", { answer_type: "timeline", action: "finish" });
}

function canSubmitBonus(bonusType: MusicQuizTimelineBonusType) {
  return (
    !props.busy &&
    !pendingAction.value &&
    !!serverAnswer.value &&
    !serverAnswer.value.finished &&
    !bonusAnswer(bonusType)
  );
}

function bonusAnswer(bonusType: MusicQuizTimelineBonusType) {
  return (
    serverAnswer.value?.bonuses.find(
      (bonus) => bonus.bonus_type === bonusType,
    ) ??
    (pendingBonus.value?.bonus_type === bonusType ? pendingBonus.value : null)
  );
}

function selectedOptionId(bonusType: MusicQuizTimelineBonusType) {
  const answer = bonusAnswer(bonusType);
  return answer?.action === "bonus_choice" ? answer.option_id : null;
}

function bonusResult(bonusType: MusicQuizTimelineBonusType) {
  return serverAnswer.value?.bonus_results?.find(
    (result) => result.bonus_type === bonusType,
  );
}

function bonusLabel(bonusType: MusicQuizTimelineBonusType) {
  return bonusType === "artist"
    ? $t("providers.music_quiz.artist_bonus")
    : $t("providers.music_quiz.title_bonus");
}
</script>
