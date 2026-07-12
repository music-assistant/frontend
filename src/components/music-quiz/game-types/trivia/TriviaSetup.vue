<template>
  <div class="flex flex-col gap-5">
    <div class="grid gap-4 sm:grid-cols-2">
      <Field>
        <FieldLabel for="trivia-rounds">
          {{ $t("providers.music_quiz.rounds") }}
        </FieldLabel>
        <NumberField
          id="trivia-rounds"
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
        <FieldLabel for="trivia-choices">
          {{ $t("providers.music_quiz.answer_choices") }}
        </FieldLabel>
        <NumberField
          id="trivia-choices"
          v-model="suggestionCount"
          :min="MIN_CHOICES"
          :max="MAX_CHOICES"
        >
          <NumberFieldContent>
            <NumberFieldDecrement />
            <NumberFieldInput />
            <NumberFieldIncrement />
          </NumberFieldContent>
        </NumberField>
      </Field>

      <Field>
        <FieldLabel for="trivia-seconds">
          {{ $t("providers.music_quiz.answer_seconds") }}
        </FieldLabel>
        <NumberField
          id="trivia-seconds"
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
        <FieldLabel for="trivia-difficulty">
          {{ $t("providers.music_quiz.difficulty") }}
        </FieldLabel>
        <NativeSelect
          id="trivia-difficulty"
          v-model="difficulty"
          class="w-full"
        >
          <option value="easy">
            {{ $t("providers.music_quiz.difficulty_easy") }}
          </option>
          <option value="normal">
            {{ $t("providers.music_quiz.difficulty_normal") }}
          </option>
          <option value="hard">
            {{ $t("providers.music_quiz.difficulty_hard") }}
          </option>
        </NativeSelect>
      </Field>

      <Field class="sm:col-span-2">
        <FieldLabel for="trivia-language">
          {{ $t("providers.music_quiz.question_language") }}
        </FieldLabel>
        <NativeSelect id="trivia-language" v-model="language" class="w-full">
          <option
            v-for="option in languageOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </NativeSelect>
      </Field>

      <Field
        orientation="horizontal"
        class="items-center justify-between rounded-lg border p-4 sm:col-span-2"
      >
        <div class="flex flex-col gap-1">
          <FieldLabel for="trivia-play-reveal-audio">
            {{ $t("providers.music_quiz.play_revealed_songs") }}
          </FieldLabel>
          <FieldDescription>
            {{ $t("providers.music_quiz.play_revealed_songs_help") }}
          </FieldDescription>
        </div>
        <Switch
          id="trivia-play-reveal-audio"
          v-model="playRevealAudio"
          data-testid="trivia-play-reveal-audio"
        />
      </Field>
    </div>

    <MusicQuizSourceSelector
      v-model="sourceUris"
      input-id="trivia-source-search"
    />

    <Button size="lg" :disabled="busy || !canCreate" @click="create">
      <Brain class="size-4" />
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";
import { Switch } from "@/components/ui/switch";
import type {
  MusicQuizDifficulty,
  MusicQuizTriviaConfig,
} from "@/composables/useMusicQuiz";
import { $t, canonicalizeLocale, getLocaleOptions, i18n } from "@/plugins/i18n";
import { Brain } from "@lucide/vue";
import { computed, ref } from "vue";

const MIN_ROUNDS = 1;
const MAX_ROUNDS = 100;
const MIN_CHOICES = 2;
const MAX_CHOICES = 8;
const MIN_SECONDS = 1;
const MAX_SECONDS = 300;

defineProps<MusicQuizSetupAdapterProps>();
const emit = defineEmits<MusicQuizSetupAdapterEmits>();

const roundCount = ref(5);
const suggestionCount = ref(4);
const answerDuration = ref(30);
const difficulty = ref<MusicQuizDifficulty>("normal");
const language = ref(i18n.global.locale.value);
const playRevealAudio = ref(true);
const sourceUris = ref<string[]>([]);
const canCreate = computed(() => sourceUris.value.length > 0);
const languageOptions = computed(() =>
  getLocaleOptions(i18n.global.availableLocales, i18n.global.locale.value),
);

function create() {
  if (!canCreate.value) return;
  const config: MusicQuizTriviaConfig = {
    language: canonicalizeLocale(language.value),
    play_reveal_audio: playRevealAudio.value,
    round_count: roundCount.value,
    suggestion_count: suggestionCount.value,
    answer_duration: answerDuration.value,
    difficulty: difficulty.value,
    source_uris: sourceUris.value,
  };
  emit("create", {
    quiz_type: "trivia",
    answer_type: "multiple_choice",
    config,
  });
}
</script>
