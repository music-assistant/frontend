<template>
  <div class="flex flex-col gap-5">
    <div class="grid gap-4 sm:grid-cols-2">
      <Field class="sm:col-span-2">
        <FieldLabel for="hitster-name">
          {{ $t("providers.music_quiz.session_name") }}
        </FieldLabel>
        <Input id="hitster-name" v-model="name" />
      </Field>

      <Field>
        <FieldLabel for="hitster-rounds">
          {{ $t("providers.music_quiz.rounds") }}
        </FieldLabel>
        <NumberField
          id="hitster-rounds"
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
        <FieldLabel for="hitster-seconds">
          {{ $t("providers.music_quiz.answer_seconds") }}
        </FieldLabel>
        <NumberField
          id="hitster-seconds"
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
        <FieldLabel for="hitster-artist-bonus">
          {{ $t("providers.music_quiz.artist_bonus") }}
        </FieldLabel>
        <NativeSelect
          id="hitster-artist-bonus"
          v-model="artistBonusMode"
          class="w-full"
        >
          <option
            v-for="option in bonusModeOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ $t(option.labelKey) }}
          </option>
        </NativeSelect>
      </Field>

      <Field>
        <FieldLabel for="hitster-title-bonus">
          {{ $t("providers.music_quiz.title_bonus") }}
        </FieldLabel>
        <NativeSelect
          id="hitster-title-bonus"
          v-model="titleBonusMode"
          class="w-full"
        >
          <option
            v-for="option in bonusModeOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ $t(option.labelKey) }}
          </option>
        </NativeSelect>
      </Field>
    </div>

    <MusicQuizSourcePicker v-model="sourceUris" />

    <Button size="lg" :disabled="busy || !canCreate" @click="create">
      <ListPlus class="size-4" />
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
import type { MusicQuizTimelineBonusMode } from "@/composables/useMusicQuiz";
import { $t } from "@/plugins/i18n";
import { ListPlus } from "@lucide/vue";
import { computed, ref } from "vue";

const MIN_ROUNDS = 1;
const MAX_ROUNDS = 50;
const MIN_SECONDS = 5;
const MAX_SECONDS = 120;

defineProps<MusicQuizSetupAdapterProps>();
const emit = defineEmits<MusicQuizSetupAdapterEmits>();

const name = ref("");
const roundCount = ref(5);
const answerDuration = ref(30);
const artistBonusMode = ref<MusicQuizTimelineBonusMode>("off");
const titleBonusMode = ref<MusicQuizTimelineBonusMode>("off");
const sourceUris = ref<string[]>([]);

const bonusModeOptions: Array<{
  value: MusicQuizTimelineBonusMode;
  labelKey: string;
}> = [
  { value: "off", labelKey: "providers.music_quiz.bonus_off" },
  { value: "free_text", labelKey: "providers.music_quiz.bonus_free_text" },
  {
    value: "multiple_choice",
    labelKey: "providers.music_quiz.bonus_multiple_choice",
  },
];

const canCreate = computed(
  () =>
    sourceUris.value.length > 0 &&
    roundCount.value >= MIN_ROUNDS &&
    roundCount.value <= MAX_ROUNDS &&
    answerDuration.value >= MIN_SECONDS &&
    answerDuration.value <= MAX_SECONDS,
);

function create() {
  if (!canCreate.value) return;
  const trimmedName = name.value.trim();
  emit("create", {
    quiz_type: "hitster",
    answer_type: "timeline",
    config: {
      round_count: roundCount.value,
      answer_duration: answerDuration.value,
      source_uris: sourceUris.value,
      ...(trimmedName ? { name: trimmedName } : {}),
      artist_bonus_mode: artistBonusMode.value,
      title_bonus_mode: titleBonusMode.value,
    },
  });
}
</script>
