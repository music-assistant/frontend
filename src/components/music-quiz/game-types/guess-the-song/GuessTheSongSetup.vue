<template>
  <div class="flex flex-col gap-5">
    <div class="grid gap-4 sm:grid-cols-2">
      <Field class="sm:col-span-2">
        <FieldLabel for="quiz-name">
          {{ $t("providers.music_quiz.session_name") }}
        </FieldLabel>
        <Input id="quiz-name" v-model="name" />
      </Field>

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
        <FieldLabel for="quiz-choices">
          {{ $t("providers.music_quiz.answer_choices") }}
        </FieldLabel>
        <NumberField
          id="quiz-choices"
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
        <FieldLabel for="quiz-difficulty">
          {{ $t("providers.music_quiz.difficulty") }}
        </FieldLabel>
        <NativeSelect id="quiz-difficulty" v-model="difficulty" class="w-full">
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
    </div>

    <MusicQuizSourcePicker v-model="sourceUris" />

    <Button
      size="lg"
      :disabled="busy || sourceUris.length === 0"
      @click="create"
    >
      <PartyPopper class="size-4" />
      {{ $t("create") }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import type {
  MusicQuizSetupAdapterEmits,
  MusicQuizSetupAdapterProps,
} from "@/components/music-quiz/adapter_contracts";
import MusicQuizSourcePicker from "@/components/music-quiz/MusicQuizSourcePicker.vue";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";
import type { MusicQuizDifficulty } from "@/composables/useMusicQuiz";
import { generateMusicQuizSessionName } from "@/helpers/music_quiz_naming";
import { $t } from "@/plugins/i18n";
import { PartyPopper } from "@lucide/vue";
import { ref } from "vue";

const MIN_ROUNDS = 2;
const MAX_ROUNDS = 50;
const MIN_CHOICES = 2;
const MAX_CHOICES = 8;
const MIN_SECONDS = 5;
const MAX_SECONDS = 120;

defineProps<MusicQuizSetupAdapterProps>();
const emit = defineEmits<MusicQuizSetupAdapterEmits>();

const name = ref(generateMusicQuizSessionName());
const roundCount = ref(5);
const suggestionCount = ref(4);
const answerDuration = ref(30);
const difficulty = ref<MusicQuizDifficulty>("normal");
const sourceUris = ref<string[]>([]);

function create() {
  if (sourceUris.value.length === 0) return;
  emit("create", {
    quiz_type: "guess_the_song",
    answer_type: "multiple_choice",
    config: {
      round_count: roundCount.value,
      suggestion_count: suggestionCount.value,
      answer_duration: answerDuration.value,
      difficulty: difficulty.value,
      source_uris: sourceUris.value,
      name: name.value.trim() || generateMusicQuizSessionName(),
    },
  });
}
</script>
