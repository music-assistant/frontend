<template>
  <div class="flex flex-col gap-5">
    <div class="grid gap-4 sm:grid-cols-2">
      <Field>
        <FieldLabel for="quiz-rounds">
          {{ $t("providers.music_quiz.rounds") }}
        </FieldLabel>
        <NumberField
          id="quiz-rounds"
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
        <FieldLabel for="quiz-seconds">
          {{ $t("providers.music_quiz.answer_seconds") }}
        </FieldLabel>
        <NumberField
          id="quiz-seconds"
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
        <FieldLabel for="quiz-hint-speed">
          {{ $t("providers.music_quiz.title_reveal_hint_speed") }}
        </FieldLabel>
        <Select v-model="hintSpeed">
          <SelectTrigger id="quiz-hint-speed" class="w-full">
            <SelectValue>{{ hintSpeedLabel }}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="option in hintSpeedOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <FieldLabel for="quiz-typo-tolerance">
          {{ $t("providers.music_quiz.title_reveal_typo_tolerance") }}
        </FieldLabel>
        <Select v-model="typoTolerance">
          <SelectTrigger id="quiz-typo-tolerance" class="w-full">
            <SelectValue>{{ typoToleranceLabel }}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="option in typoToleranceOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field
        orientation="horizontal"
        class="items-center justify-between rounded-lg border p-4 sm:col-span-2"
      >
        <div class="flex flex-col gap-1">
          <FieldLabel for="title-reveal-artist-bonus">
            {{ $t("providers.music_quiz.title_reveal_artist_bonus_setting") }}
          </FieldLabel>
          <FieldDescription>
            {{
              $t("providers.music_quiz.title_reveal_artist_bonus_setting_help")
            }}
          </FieldDescription>
        </div>
        <Switch
          id="title-reveal-artist-bonus"
          v-model="artistBonus"
          data-testid="title-reveal-artist-bonus"
        />
      </Field>
    </div>

    <slot name="before-sources"></slot>

    <MusicQuizSourceSelector
      v-model="sourceUris"
      input-id="quiz-source-search"
    />

    <Button
      size="lg"
      :disabled="busy || !canCreate || !sharedConfigValid"
      @click="create"
    >
      <Plus class="size-4" />
      {{ $t("create") }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import MusicQuizSourceSelector from "@/components/music-quiz/MusicQuizSourceSelector.vue";
import type {
  MusicQuizSetupAdapterEmits,
  MusicQuizSetupAdapterProps,
  MusicQuizSetupAdapterSlots,
} from "@/components/music-quiz/adapter_contracts";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type {
  MusicQuizHintSpeed,
  MusicQuizTitleRevealConfig,
  MusicQuizTypoTolerance,
} from "@/composables/music-quiz/useMusicQuiz";
import {
  getMusicQuizHintSpeedOptions,
  getMusicQuizTypoToleranceOptions,
} from "@/helpers/music_quiz_hint_text";
import { $t } from "@/plugins/i18n";
import { Plus } from "@lucide/vue";
import { computed, ref } from "vue";

const MIN_ROUNDS = 2;
const MAX_ROUNDS = 50;
// typed guesses need more time than picking an option
const MIN_SECONDS = 10;
const MAX_SECONDS = 120;
const DEFAULT_SECONDS = 45;

const props = withDefaults(defineProps<MusicQuizSetupAdapterProps>(), {
  sharedConfigValid: true,
});
defineSlots<MusicQuizSetupAdapterSlots>();
const emit = defineEmits<MusicQuizSetupAdapterEmits>();

const roundCount = ref(5);
const answerDuration = ref(DEFAULT_SECONDS);
const hintSpeed = ref<MusicQuizHintSpeed>("normal");
const typoTolerance = ref<MusicQuizTypoTolerance>("normal");
const artistBonus = ref(true);
const sourceUris = ref<string[]>([]);
const canCreate = computed(() => sourceUris.value.length > 0);
const hintSpeedOptions = computed(() => getMusicQuizHintSpeedOptions());
const typoToleranceOptions = computed(() => getMusicQuizTypoToleranceOptions());
const hintSpeedLabel = computed(
  () =>
    hintSpeedOptions.value.find((option) => option.value === hintSpeed.value)
      ?.label ?? "",
);
const typoToleranceLabel = computed(
  () =>
    typoToleranceOptions.value.find(
      (option) => option.value === typoTolerance.value,
    )?.label ?? "",
);

function create() {
  if (!canCreate.value || !props.sharedConfigValid) return;
  const config: MusicQuizTitleRevealConfig = {
    round_count: roundCount.value,
    answer_duration: answerDuration.value,
    hint_speed: hintSpeed.value,
    typo_tolerance: typoTolerance.value,
    artist_bonus_mode: artistBonus.value ? "free_text" : "off",
    source_uris: sourceUris.value,
    include_similar_music: props.includeSimilarMusic,
  };
  emit("create", {
    quiz_type: "title_reveal",
    answer_type: "hint_text",
    config,
  });
}
</script>
