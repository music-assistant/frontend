<template>
  <div class="flex flex-col gap-5">
    <div class="grid gap-4 sm:grid-cols-2">
      <Field>
        <FieldLabel for="music-timeline-rounds">
          {{ $t("providers.music_quiz.rounds") }}
        </FieldLabel>
        <NumberField
          id="music-timeline-rounds"
          v-model="roundCount"
          :min="MIN_ROUNDS"
          :max="MAX_ROUNDS"
        >
          <NumberFieldContent>
            <NumberFieldDecrement />
            <NumberFieldInput />
            <NumberFieldIncrement />
          </NumberFieldContent>
        </NumberField>
      </Field>

      <Field>
        <FieldLabel for="music-timeline-seconds">
          {{ $t("providers.music_quiz.answer_seconds") }}
        </FieldLabel>
        <NumberField
          id="music-timeline-seconds"
          v-model="answerDuration"
          :min="MIN_SECONDS"
          :max="MAX_SECONDS"
        >
          <NumberFieldContent>
            <NumberFieldDecrement />
            <NumberFieldInput />
            <NumberFieldIncrement />
          </NumberFieldContent>
        </NumberField>
      </Field>

      <Field>
        <FieldLabel for="music-timeline-artist-bonus">
          {{ $t("providers.music_quiz.timeline_artist_bonus") }}
        </FieldLabel>
        <NativeSelect
          id="music-timeline-artist-bonus"
          v-model="artistBonusMode"
          class="w-full"
        >
          <option
            v-for="option in bonusModeOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </NativeSelect>
      </Field>

      <Field>
        <FieldLabel for="music-timeline-title-bonus">
          {{ $t("providers.music_quiz.timeline_title_bonus") }}
        </FieldLabel>
        <NativeSelect
          id="music-timeline-title-bonus"
          v-model="titleBonusMode"
          class="w-full"
        >
          <option
            v-for="option in bonusModeOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </NativeSelect>
      </Field>
    </div>

    <MusicQuizSourceSelector
      v-model="sourceUris"
      input-id="music-timeline-source-search"
    />

    <Button size="lg" :disabled="busy || !canCreate" @click="create">
      <ListPlus class="size-4" />
      {{ $t("create") }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import MusicQuizSourceSelector from "@/components/music-quiz/MusicQuizSourceSelector.vue";
import type {
  MusicQuizSetupAdapterEmits,
  MusicQuizSetupAdapterProps,
} from "@/components/music-quiz/adapter_contracts";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";
import type {
  MusicQuizTimelineConfig,
  MusicQuizTimelineBonusMode,
} from "@/composables/useMusicQuiz";
import { $t } from "@/plugins/i18n";
import { ListPlus } from "@lucide/vue";
import { computed, ref } from "vue";

const MIN_ROUNDS = 1;
const MAX_ROUNDS = 100;
const MIN_SECONDS = 1;
const MAX_SECONDS = 300;

const props = defineProps<MusicQuizSetupAdapterProps>();
const emit = defineEmits<MusicQuizSetupAdapterEmits>();

const roundCount = ref(5);
const answerDuration = ref(30);
const artistBonusMode = ref<MusicQuizTimelineBonusMode>("off");
const titleBonusMode = ref<MusicQuizTimelineBonusMode>("off");
const sourceUris = ref<string[]>([]);
const canCreate = computed(() => sourceUris.value.length > 0);
const bonusModeOptions = computed(() => [
  {
    value: "off" as const,
    label: $t("providers.music_quiz.timeline_bonus_off"),
  },
  {
    value: "free_text" as const,
    label: $t("providers.music_quiz.timeline_bonus_free_text"),
  },
  {
    value: "multiple_choice" as const,
    label: $t("providers.music_quiz.timeline_bonus_multiple_choice"),
  },
]);

function create() {
  if (!canCreate.value) return;
  const config: MusicQuizTimelineConfig = {
    round_count: roundCount.value,
    answer_duration: answerDuration.value,
    source_uris: sourceUris.value,
    include_similar_music: props.includeSimilarMusic,
    artist_bonus_mode: artistBonusMode.value,
    title_bonus_mode: titleBonusMode.value,
  };
  emit("create", {
    quiz_type: "music_timeline",
    answer_type: "timeline",
    config,
  });
}
</script>
